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

const tagInfoFields = {
  "Date of entry:": { // TODO: these should be date time with date pickers
      type: "date"
  },
  "Date of abatement:": { // TODO: these should be date time with date pickers
      type: "date"
  },
  "Number of tags:": {
      type: "number"
  },
  "Tag text (separated by commas):": {
      type: "input"
  },
  "Small tag text (separated by commas):": {
      type: "input"
  },
  "Square footage covered:": {
      type: "number"
  },
  "Racial or hate tone?": {
      type: "radio",
      options: {
          yes: "Yes",
          no: "No",
          other: "Other"
      }
  },
  "Gang related:": {
      type: "radio",
      options: {
          yes: "Yes",
          no: "No",
          other: "Other"
      }
  },
  "Crossed out tag:": {
      type: "radio",
      options: {
          yes: "Yes",
          no: "No",
          other: "Other"
      }
  },
  "Type of property:": {
      type: "radio",
      options: {
          commercial: "Commercial",
          residential: "Residential",
          public: "Public"
      }
  },
  "Vacant property:": {
      type: "radio",
      options: {
          yes: "Yes",
          no: "No",
          other: "unknown"
      }
  },
  "Land bank property:": {
      type: "radio",
      options: {
          yes: "Yes",
          no: "No",
          other: "unknown"
      }
  },
  "Surface:": {
      type: "checkbox",
      options: {
          brick: "Brick or Stone",
          concrete: "Concrete",
          wood: "Wood",
          glass: "Glass",
          painted: "Painted",
          others: "other"
      }
  },
  "Surface other:": {
      type: "input"
  },
  "Need other code enforcement?": {
      type: "checkbox",
      options: {
          buildingDisrepair: "Building disrepair",
          weeds: "Weeds",
          trash: "Trash",
          illegalDumping: "Illegal dumping",
          others: "other"
      }
  },
  "Other code enforcement:": {
      type: "input"
  }
};

// remap tagInfoFields to match option-#-# pattern
const tagInfoFieldsMap = {};

Object.keys(tagInfoFields).forEach((formField, index) => {
  const fieldData = tagInfoFields[formField];

  if (fieldData.type === 'radio' || fieldData.type === 'checkbox') {
    const optionsKeys = Object.keys(tagInfoFields[formField].options);
    for (let i = 0; i < optionsKeys.length; i++) {
      tagInfoFieldsMap[`option-${index}-${i}`] = optionsKeys[i];
    };
  } else {
    tagInfoFieldsMap[`option-${index}`] = '';
  }
});

/**
 * the key is in the format of option-#-# where the # corresponds to depth based on tagInfoFields
 * for example:
 * option-6-1
 * translates to:
 * Racial or hate tone? No (6, 1)
 */
const processTagInfoField = (key, value) => {
  const formFieldValue = tagInfoFieldsMap[key];

  if (formFieldValue && value) {
    return formFieldValue;
  } else {
    return value;
  }
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
  const userId = await getUserIdFromToken(req.token);
  const syncId = await getRecentSyncId(userId);
  // const syncId = 8; // dev
  const data = await bundleData(syncId);
  const dataKeys = Object.keys(data);
  
  if (dataKeys.length) {
    const wb = new xl.Workbook();
    const addresses = [];
    let activeAddress;
    let optColIndex = 1;

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
                wsChain.number(cellValue.length);
              }
            }

            if (key === 'tags') {
              activeAddress = addresses[sheetDataRow];
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

                Object.keys(formData).forEach(formField => {
                  const formFieldValue = processTagInfoField(formField, formData[formField]);

                  if (formFieldValue) {
                    wsChain = ws.cell(2 + sheetDataRow, 1 + optColIndex);
                    wsChain.string(formFieldValue);
                    optColIndex += 1;
                  }
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