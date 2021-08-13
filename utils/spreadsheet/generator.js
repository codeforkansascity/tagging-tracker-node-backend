// this has to generate the spreadsheet
// temporarily host it
// delete it later after client downloads it
// hierarchy: address > events > tags
// multiple rows of addresses based on multiple rows of events
// then horizontally expands per event by number of tags
// will end up adding headers per section since they will not line up by the parent/first header

/**
 * data available:
 * address - address, lat, lng, created
 * owner info - name, phone, email, tenant name, tenant contact number, waiver completed, need to follow up, survey: continue service
 * event - 
 */

const xl = require('excel4node');
const { bundleData } = require('../sync/sync-down');


const generateSpreadsheet = async (req, res) => {
  // use sync-down methods since it builds all the data needed already
  // const data = await bundleData();
  console.log(data);
  res.status(200).send('ok');
}
 
module.exports = {
  generateSpreadsheet
}