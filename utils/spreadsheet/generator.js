// this is kind of nasty how this spreadsheet is generated
// primarily due to the cherry picked data and camel case key formatting from the data to the spreadsheet

// the data should have been pre-sorted/arranged in the way it would be generated across the spreadsheet tabs

// the gist is the data is grabbed/generated from the most recent user's sync id and the bundleData method from sync-down.js
// the headers are set per spreadsheet tab and then not all columns are dumped out, hence specific filtering per tab
// that's the nasty part, but if you fold all, you can see the higher separation/workflow

const fs = require('fs');
const xl = require('excel4node');
const { bundleData } = require('../sync/sync-down');
const { processTagInfoField } = require('../misc/tagInfoFields');

const camelCapMap = {
  'addresses': 'Addresses',
  'events': 'Events',
  'tags': 'Tags',
  'ownerInfo': 'Owner Info',
  'tagInfo': 'Tag Info'
};

const headerMap = {
  'address': ['Address', 'lat', 'lng', 'created', 'updated'],
  'events': ['Address', 'Date', 'Tags'],
  'tags': ['Address', 'Date', 'Url'],
  'ownerInfo': [
    'Address', 'Name', 'Phone', 'Email', 'Tenant Name', 'Tenant Phone #', 'Waiver Completed', 'Need Follow Up',
    'Building Survey Answer'
  ],
  'tagInfo': [
    'Address', 'Date Of Picture', 'Date Of Abatement', 'Number Of Tags', 'Tag Text', 'Small Tag Text', 'Square Footage Covered',
    'Racial Or Hate Tone', 'Gang Related', 'Crossed Out Tag', 'Type Of Property', 'Vacant Property', 'Land Bank Property',
    'Surface', 'Other Surface', 'Need Other Code Enforcement', 'Other Code Enforcement'
  ]
};

const addSheetHeader = (key, ws, darkGreyHeaderStyle) => {
  // these are known keys from the bundleData from sync-down file
  if (key === 'addresses') {
    headerMap['address'].forEach((header, headerIndex) => {
      ws.cell(1, headerIndex + 1)
        .string(header)
        .style(darkGreyHeaderStyle);
    });
  } else {
    headerMap[key].forEach((header, headerIndex) => {
      ws.cell(1, headerIndex + 1)
        .string(header)
        .style(darkGreyHeaderStyle);
    });
  }
};

const generateSpreadsheet = async (req, res) => {
  // const userId = await getUserIdFromToken(req.token);
  // const syncId = await getRecentSyncId(userId);
  const syncId = 2; // dev
  const data = await bundleData(syncId);
  const dataKeys = Object.keys(data);
  
  if (dataKeys.length) {
    const wb = new xl.Workbook();
    const addresses = [];
    let activeAddress;
    let optColIndex = 1;
    const tagsAddresses = [];

    const darkGreyHeaderStyle = wb.createStyle({
      font: {
        color: 'white',
        size: 12,
      },
      fill: {
        type: 'pattern',
        patternType: 'solid',
        fgColor: '#282828', 
      }
    });

    const cellStyle = wb.createStyle({
      font: {
        color: 'black',
        size: 12,
      },
    });

    dataKeys.forEach(key => {
      const ws = wb.addWorksheet(camelCapMap[key]);
      const sheetData = data[key];

      if (sheetData) {
        for (let sheetDataRow = 0; sheetDataRow < sheetData.length; sheetDataRow++) {
          optColIndex = 1;
          addSheetHeader(key, ws, darkGreyHeaderStyle);

          Object.keys(sheetData[sheetDataRow]).forEach((sheetDataKey, sheetDataKeyIndex) => {
            const cellValue = sheetData[sheetDataRow][sheetDataKey];
            let wsChain;

            if (key === 'addresses') {
              wsChain = ws.cell(2 + sheetDataRow, sheetDataKeyIndex + 1);

              if (sheetDataKey === 'address') {
                activeAddress = cellValue;
                addresses.push(cellValue);
              }

              // crude type checking
              if (typeof cellValue === 'object') {
                const objStr = JSON.stringify(cellValue);
                if (objStr.indexOf('.000Z') !== -1) {
                  wsChain.string(objStr.split('T')[0].replace('"', ''));
                } else {
                  wsChain.string(objStr);
                }
              } else if (typeof cellValue === 'number') {
                wsChain.number(cellValue);
              } else {
                wsChain.string(cellValue);
              }
            }

            if (key === 'events') {
              activeAddress = addresses[sheetDataRow];
              const ommitKeys = ['tag_info_id'];

              if (ommitKeys.indexOf(sheetDataKey) !== -1) {
                return;
              }

              if (sheetDataKey === 'address_id') {
                wsChain = ws.cell(2 + sheetDataRow, 1);
                wsChain.string(activeAddress);
              } else if (sheetDataKey === 'date_time') {
                wsChain = ws.cell(2 + sheetDataRow, 2);
                wsChain.string(JSON.stringify(cellValue).split('T')[0].replace('"', ''));
              } else if (sheetDataKey === 'tag_ids') {
                wsChain = ws.cell(2 + sheetDataRow, 3);
                wsChain.number(JSON.parse(cellValue).length);
              }
            }

            if (key === 'tags') {
              activeAddress = addresses[sheetDataRow];

              if (activeAddress && tagsAddresses.indexOf(activeAddress) === -1) {
                tagsAddresses.push(activeAddress);
              }

              const ommitKeys = ['event_id', 'file_name',  'meta', 'name', 'thumbnail_src'];

              if (ommitKeys.indexOf(sheetDataKey) !== -1) {
                return;
              }

              if (sheetDataKey === 'address_id') {
                wsChain = ws.cell(2 + sheetDataRow, 1);
                wsChain.string(tagsAddresses[sheetData[sheetDataRow].address_id - 1]);
              }

              if (sheetDataKey === 'datetime') {
                wsChain = ws.cell(2 + sheetDataRow, 2);
                wsChain.string(JSON.stringify(cellValue).split('T')[0].replace('"', ''));
              }

              if (sheetDataKey === 'url') {
                wsChain = ws.cell(2 + sheetDataRow, 3);
                wsChain.string(cellValue);
              }
            }

            if (key === 'ownerInfo') {
              activeAddress = addresses[sheetDataRow];
              if (sheetDataKey === 'address_id') {
                wsChain = ws.cell(2 + sheetDataRow, 1);
                wsChain.string(activeAddress);
              } else {
                const formData = JSON.parse(cellValue);

                Object.keys(formData).forEach((formField, formFieldIndex) => {
                  wsChain = ws.cell(2 + sheetDataRow, 2 + formFieldIndex);
                  wsChain.string(formData[formField]);
                });
              }
            }

            if (key === 'tagInfo') {
              activeAddress = addresses[sheetDataRow];

              if (sheetDataKey === 'address_id') {
                wsChain = ws.cell(2 + sheetDataRow, 1);
                wsChain.string(activeAddress);
              }

              if (sheetDataKey === 'form_data') {
                const formData = JSON.parse(cellValue);

                // pre-sort the data since writing into a cell is currently one time
                const groupedFormData = {};

                Object.keys(formData).forEach(formField => {
                  const formFieldValue = processTagInfoField(formField, formData[formField]);
                  let subFormField = formField.split('option-')[1];

                  if (subFormField.indexOf('-') !== -1) {
                    subFormField = subFormField.split('-')[0];
                  }

                  if (formFieldValue) {
                    if (!(subFormField in groupedFormData)) {
                      groupedFormData[subFormField] = [formFieldValue];
                    } else {
                      groupedFormData[subFormField].push(formFieldValue);
                    }
                  }
                });

                Object.keys(groupedFormData).forEach(groupedFormDataKey => {
                    wsChain = ws.cell(2 + sheetDataRow, 1 + optColIndex);
                    wsChain.string(groupedFormData[groupedFormDataKey].join(', '));
                    optColIndex += 1;
                });
              }
            }

            if (wsChain) {
              wsChain.style(cellStyle);
            }
          });
        };
      }

    });

    wb.write('TaggingTrackerUserSyncDump.xlsx', res);
    return;
  }

  res.status(409).send(false);
};
 
module.exports = {
  generateSpreadsheet
};