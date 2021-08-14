// this is kind of nasty how this spreadsheet is generated
// primarily due to the cherry picked data and camel case key formatting from the data to the spreadsheet
// the gist is the data is grabbed/generated from the most recent user's sync id and the bundleData method from sync-down.js
// the headers are set per spreadsheet tab and then not all columns are dumped out, hence specific filtering per tab
// that's the nasty part, but if you fold all, you can see the higher separation/workflow

const fs = require('fs');
const xl = require('excel4node');
const { bundleData } = require('../sync/sync-down');

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

// this is nasty need some camel case to cap function
const ownerInfoHeaderMap = {
  'dateOfPicture': 'Date Of Picture',
  'dateOfAbatement': 'Date Of Abatement',
  'numberOfTags': 'Number Of Tags',
  'tagText': 'Tag Text',
  'smallTagText': 'Small Tag Text',
  'squareFootageCovered': 'Square Footage Covered',
  'racialOrHateTone': 'Racial Or Hate Tone',
  'gangRelated': 'Gang Related',
  'crossedOutTag': 'Crossed Out Tag',
  'typeOfProperty': 'Type Of Property',
  'vacantProperty': 'Vacant Property',
  'landBankProperty': 'Land Bank Property',
  'surface': 'Surface',
  'otherSurface': 'Other Surface',
  'needOtherCodeEnforcement': 'Need Other Code Enforcement',
  'otherCodeEnforcement': 'Other Code Enforcement'
};

const ownerInfoKeyMap = {
  "option-0": "dateOfPicture",
  "option-1": "dateOfAbatement",
  "option-2": "numberOfTags",
  "option-3": "tagText",
  "option-4": "smallTagText",
  "option-5": "squareFootageCovered",
  "option-6-0": "racialOrHateTone",
  "option-6-1": "racialOrHateTone",
  "option-6-2": "racialOrHateTone",
  "option-7-0": "gangRelated",
  "option-7-1": "gangRelated",
  "option-7-2": "gangRelated",
  "option-8-0": "crossedOutTag",
  "option-8-1": "crossedOutTag",
  "option-8-2": "crossedOutTag",
  "option-9-0": "typeOfProperty",
  "option-9-1": "typeOfProperty",
  "option-9-2": "typeOfProperty",
  "option-10-0": "vacantProperty",
  "option-10-1": "vacantProperty",
  "option-10-2": "vacantProperty",
  "option-11-0": "landBankProperty",
  "option-11-1": "landBankProperty",
  "option-11-2": "landBankProperty",
  "option-12-0": "surface",
  "option-12-1": "surface",
  "option-12-2": "surface",
  "option-12-3": "surface",
  "option-12-4": "surface",
  "option-12-5": "surface",
  "option-13-0": "otherSurface",
  "option-14-0": "needOtherCodeEnforcement",
  "option-14-1": "needOtherCodeEnforcement",
  "option-14-2": "needOtherCodeEnforcement",
  "option-14-3": "needOtherCodeEnforcement",
  "option-14-4": "needOtherCodeEnforcement",
  "option-15-0": "otherCodeEnforcement"
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
  const syncId = 4;
  const data = await bundleData(syncId);
  const dataKeys = Object.keys(data);
  
  if (dataKeys.length) {
    const wb = new xl.Workbook();
    let activeAddress;
    let optCulInc = 1; // this is used when col does not automatically increment, in the case of filtered columns

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

    console.log(dataKeys);

    dataKeys.forEach(key => {
      const ws = wb.addWorksheet(camelCapMap[key]);
      const sheetData = data[key];

      if (sheetData) {
        for (let sheetDataRow = 0; sheetDataRow < sheetData.length; sheetDataRow++) {
          optCulInc = 1;
          console.log(key);
          addSheetHeader(key, ws, darkGreyHeaderStyle);

          console.log(Object.keys(sheetData[sheetDataRow]));

          Object.keys(sheetData[sheetDataRow]).forEach((sheetDataKey, sheetDataKeyIndex) => {
            const cellValue = sheetData[sheetDataRow][sheetDataKey];
            let wsChain;

            if (key === 'addresses') {
              wsChain = ws.cell(2 + sheetDataRow, sheetDataKeyIndex + 1);

              if (sheetDataKey === 'address') {
                activeAddress = cellValue;
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
                wsChain.number(cellValue.length);
              }
            }

            if (key === 'tags') {
              const ommitKeys = ['event_id', 'file_name',  'meta', 'name', 'thumbnail_src'];
              if (ommitKeys.indexOf(sheetDataKey) !== -1) {
                return;
              }

              if (sheetDataKey === 'address_id') {
                wsChain = ws.cell(2 + sheetDataRow, 1);
                wsChain.string(activeAddress);
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

  res.status(200).send(data);
}
 
module.exports = {
  generateSpreadsheet
}