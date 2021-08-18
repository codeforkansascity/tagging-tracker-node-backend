// this has a lazy implementation currently
// just grabbing everything this user synced
// then filtering out the specific address > hierarchy
// the pdf format is:
// address
// - owner info
// - event
//   - tag info
//   - tags (images)

const http = require('http'); // https
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { bundleData } = require('../sync/sync-down');
const { processTagInfoField } = require('../misc/tagInfoFields');
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
  // return new Promise(resolve => {

    // const userId = await getUserIdFromToken(req.token);
    // const addressId = req.addressId;
    // const syncId = await getRecentSyncId(userId);
    const addressName = '2113 Prospect Ave';
    const syncId = 8; // dev
    const data = await bundleData(syncId);

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

      const writeStream = fs.createWriteStream('./public/TaggingTrackerAddress.pdf');
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
          let appendedImgs = 0;
          let horizontalOffset;

          Object.keys(tagRows).forEach((tagRow, index) => {
            if (tagRows[tagRow].address_id === activeAddressId) {
              // get dimensions for proportions estimate to put images next to each other/use space better
              const imageMeta = JSON.parse(tagRows[tagRow].meta);
              const imageAr = imageMeta.height / imageMeta.width; // backwards since height oriented


              // this needs better math, figure out the width taken up by each image,
              // sort them to fill up the space, height is not enough



              // url is direct full size path from AWS S3
              // margins are 100 all around

              let tmpIndex = index;
              if ((tmpIndex + 1) % 2 === 0) { // even
                horizontalOffset = Math.ceil(imageAr * 350) + 10;
              } else {
                horizontalOffset = 0;
              }
              
              if (isSecure) {
                doc.image(
                  tagRows[tagRow].url,
                  (horizontalOffset + 100), // left
                  (100 + (appendedImgs * 350)), // top
                  {height: 350}) // scales proportionally
                ;
              } else {
                doc.image(
                  tagRows[tagRow].thumbnail_src,
                  (horizontalOffset + 100),
                  (100 + (appendedImgs * 350)),
                  {height: 350}
                );
              }

              appendedImgs += 1;

              if (appendImgs > 4) {
                docPages += 1;
              }
            }
          });

          docPages += 1;
        }
      });

      doc.end();

      writeStream.on('finish', () => {
        // pipe out file then delete it
        // const file = fs.createWriteStream('./public/TaggingTrackerAddress.pdf');
        // res.download('./public/TaggingTrackerAddress.pdf');
        res.status(200).send(true);
        responseSent = true;
      });

    } else {
      responseSent = true;
      res.status(200).send(true);
    }

    setTimeout(() => {
      // something went wrong
      if (!responseSent) {
        res.status(500).send(false);
      }
    }, 10000);

  // });
};

module.exports = {
  generatePdf
};