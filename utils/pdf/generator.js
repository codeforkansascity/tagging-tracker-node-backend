// this has a lazy implementation currently
// just grabbing everything this user synced
// then filtering out the specific address > hierarchy
// the pdf format is:
// address
// - owner info
// - event
//   - tag info
//   - tags (images)

const fs = require('fs');
const PDFDocument = require('pdfkit');
const { bundleData } = require('../sync/sync-down');
const { processTagInfoField } = require('../misc/tagInfoFields');
const { makeRandomStr } = require('./../misc/stringGenerator');
const { getUserIdFromToken, getRecentSyncId } = require('../users/userFunctions');
const axios = require('axios');

let responseSent = false;

const ownerInfoFieldMap = {
  name: 'Name',
  phone: 'Phone',
  email: 'Email',
  tenantName: 'Tenant name',
  tenantPhoneNumber: 'Tenant phone number',
  waiverCompleted: 'Waiver completed',
  needFollowUp: 'Need follow up',
  buildingSurveyQuestionAnswer: 'Building survey question answer',
};

const tagInfoFieldMap = [
  'Date Of Picture', 'Date Of Abatement', 'Number Of Tags', 'Tag Text', 'Small Tag Text', 'Square Footage Covered',
  'Racial Or Hate Tone', 'Gang Related', 'Crossed Out Tag', 'Type Of Property', 'Vacant Property', 'Land Bank Property',
  'Surface', 'Other Surface', 'Need Other Code Enforcement', 'Other Code Enforcement'
];

const generatePdf = async (req, res) => {
  // https://stackoverflow.com/a/66006090
  // it is lazy to send a token as params, particularly due to url length of 2083 but this token is small it's just enconding the username
  // it's generally around a couple hundred chars long
  const userId = await getUserIdFromToken(res, req.query.token);
  const syncId = await getRecentSyncId(userId);
  const addressName = decodeURIComponent(req.query.address);
  const data = await bundleData(syncId);
  const publicPdfPath = `./public/TaggingTrackerAddress-${makeRandomStr(8)}.pdf`; // random str is for "unique" files

  if (data) {
    // start building pdf
    let docPages = 0;
    const doc = new PDFDocument({
      bufferPages: true,
      size: [750, 970],
      dpi: 400,
      margins: {
        top: 50, left: 50, right: 50, bottom: 50,
      },
      layout: 'portrait',
      info: {
        Title: 'Tagging Tracker Address',
      }
    });

    const writeStream = fs.createWriteStream(publicPdfPath);
    doc.pipe(writeStream);

    // add address
    doc.fontSize(12);
    doc.font('Courier-Bold');
    doc.text(addressName);
    doc.font('Courier');
    doc.fontSize(10);
    doc.text('\n');

    // loop through content and add to pdf

    // the addressIds are based on the PWA's local rows
    // this does suck but the syncs are based on syncId so they follow the hierarchy of
    // auth token > sync Id > local PWA rows
    // it works out because all the data is formatted to match those local rows when synced up
    // the addressIds are not used to look up against the addresses table which have incrementing ids
    // the address names are unique so that is used to determine the local PWA address id
    // present in the recently synced data
    // might force a sync up before downloading PDF just to catch up data
    // in case rows are deleted

    let activeAddressId;

    const addressRows = data['addresses'];
    Object.keys(addressRows).forEach((addressIndex, index) => {
      if (addressRows[addressIndex].address === addressName) {
        activeAddressId = index + 1; // inferred from order by id
      }
    });

    // pages are added top-down with data per address
    // so the loop goes in order: address > events > owner info > tag info > tags
    // those are applied to the pages in order
    // image dimensions constrained by page dimensions set above in doc
    // not even considering the n*n stuff (exec delay with loops within loops)
    const eventRows = data['events'];
    Object.keys(eventRows).forEach(eventIndex => {
      // filter out data based on activeAddressId
      if (eventRows[eventIndex].address_id === activeAddressId) {
        // this is dumb
        const dateStringParts = eventRows[eventIndex].date_time.toString().split(' ');
        doc.font('Courier-Bold');
        doc.text('Owner info');
        doc.font('Courier');
        doc.fontSize(8);
        doc.text('\n');
        doc.text(dateStringParts[1] + dateStringParts[2] + ', ' + dateStringParts[3]);

        const ownerInfoRows = data['ownerInfo'];
        Object.keys(ownerInfoRows).forEach(ownerInfoRowIndex => {
          if (ownerInfoRows[ownerInfoRowIndex].address_id === activeAddressId) {
            const formDataFields = JSON.parse(ownerInfoRows[ownerInfoRowIndex].form_data);
            Object.keys(formDataFields).forEach(formDataField => {
              doc.text(ownerInfoFieldMap[formDataField] + ': ' + formDataFields[formDataField]);
            });
          }
        });

        doc.text('\n');
        doc.fontSize(10);
        doc.font('Courier-Bold');
        doc.text('Events');
        doc.font('Courier');

        const tagInfoRows = data['tagInfo'];
        // again this is terribly wasteful partial used loops within loops
        // but at this scale, compute doesn't really matter
        Object.keys(tagInfoRows).forEach(tagInfoRowIndex => {
          if (tagInfoRows[tagInfoRowIndex].address_id === activeAddressId) {
            const tagInfoFields = JSON.parse(tagInfoRows[tagInfoRowIndex].form_data);
            let prevFormFieldPrimaryIndex;

            Object.keys(tagInfoFields).forEach((formField, formFieldIndex) => {
              let formFieldPrimaryIndex = formField.split('option-')[1];
              const formFieldValue = processTagInfoField(formField, tagInfoFields[formField]);

              if (formFieldPrimaryIndex.indexOf('-') !== -1) {
                formFieldPrimaryIndex = formFieldPrimaryIndex.split('-')[0];
              }

              if (!prevFormFieldPrimaryIndex || formFieldPrimaryIndex !== prevFormFieldPrimaryIndex) {
                doc.fontSize(4);
                doc.text('\n');
                doc.fontSize(9);
                doc.text(tagInfoFieldMap[formFieldPrimaryIndex]);
              }

              if (formFieldValue) {
                doc.fontSize(8);
                doc.text(formFieldValue, {
                  indent: 8,
                });
              }

              prevFormFieldPrimaryIndex = formFieldPrimaryIndex;
            });
          }
        });

        // show tags for the event on new page just for sake of coordinate tracking
        doc.addPage();
        docPages += 1;
        doc.switchToPage(docPages);
        doc.text('\n');
        doc.fontSize(10);
        doc.font('Courier-Bold');
        doc.text('Tags');
        doc.font('Courier');

        const tagRows = data['tags'];
        const isSecure = req.protocol === 'https';
        let addressEventImgs = [];
        let horizontalOffset = 50; // the initial values are based on doc margins set above
        let verticalOffset = 70; // + 20 for text

        // the images are going to be scaled to 300 by their largest dimension
        // each image will get put inside a quadrant, I'm not going to bother trying to best fit them because
        // that requires more math, main thing is 4 images per page, possibly multiple pages per address event

        Object.keys(tagRows).forEach(tagRow => {
          const imageMeta = JSON.parse(tagRows[tagRow].meta);

          if (tagRows[tagRow].address_id === activeAddressId) {
            let imgWidth;
            let imgHeight;
            const imgAr = imageMeta.width / imageMeta.height;
            
            if (imgAr >= 1) {
              imgWidth = imageMeta.width >= 300 ? 300 : undefined;
            } else {
              imgHeight = imageMeta.height >= 300 ? 300 : undefined;
            }

            addressEventImgs.push({
              url: tagRows[tagRow].url,
              thumbnail_src: tagRows[tagRow].thumbnail_src,
              width: imgWidth,
              height: imgHeight,
            });
          }
        });

        addressEventImgs.forEach(async (img, index) => {
          const imgDimensions = {}; // PDFKit proportional image just need one dimension key i.e. width or height

          if (img.width) {
            imgDimensions.width = img.width;
          } else {
            imgDimensions.height = img.height;
          }

          if ((index + 1) % 2 === 0) { // even
            horizontalOffset = 360;
          } else {
            horizontalOffset = 50;
          }

          if (isSecure) {
            // fix for readFileSync
            // https://stackoverflow.com/a/60506358/2710227

            const awsS3ImgRes = await axios.get(img.url, { responseType: 'arrayBuffer' });
            const awsS3ImgBuff = Buffer.from(awsS3ImgRes);

            doc.image(
              awsS3ImgBuff,
              (horizontalOffset), // left
              (verticalOffset), // top
              {...imgDimensions})
            ;
          } else {
            doc.image(
              img.thumbnail_src,
              (horizontalOffset),
              (verticalOffset),
              {...imgDimensions}
            );
          }

          if ((index + 1) % 2 === 0) { // even
            verticalOffset += 360;
          }

          if ((index + 1) % 4 === 0) {
            doc.addPage();
            docPages += 1;
            doc.switchToPage(docPages);
            verticalOffset = 50;
          }
        });

        docPages += 1;
      }
    });

    doc.end();

    writeStream.on('finish', () => {
      // pipe out file then delete it
      res.download(publicPdfPath, `Tagging Tracker - ${addressName}`, (err) => {
        fs.unlink(publicPdfPath, () => {
          // deleted (hopefully)
        });
      });
      
      // res.status(200).send(true); // dev
      responseSent = true;
    });

  } else {
    responseSent = true;
    res.status(200).send(false);
  }

  setTimeout(() => {
    // something went wrong
    if (!responseSent) {
      res.status(500).send(false);
    }
  }, 10000);
};

module.exports = {
  generatePdf
};