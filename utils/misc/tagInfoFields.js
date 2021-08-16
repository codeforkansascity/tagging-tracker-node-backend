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

module.exports = {
  tagInfoFields,
  processTagInfoField
};