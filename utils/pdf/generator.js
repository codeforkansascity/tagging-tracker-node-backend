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
      doc.text(addressName);
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
          doc.text('Owner info');
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
        }
      });


      doc.end();

      writeStream.on('finish', () => {
        console.log('/public/TaggingTrackerAddress.pdf');
      });

    }

    res.status(200).send(data);

  // });
};

module.exports = {
  generatePdf
};