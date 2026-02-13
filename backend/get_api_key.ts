import sequelize from './utils/dbInstance';
import { QueryTypes } from 'sequelize';

async function getApiKey() {
  try {
    const result = await sequelize.query<{apiKey: string; base_currency: string}>(
      'SELECT "apiKey", base_currency FROM tbl_api WHERE company_id = 38 LIMIT 1',
      { type: QueryTypes.SELECT }
    );
    
    if (result.length > 0) {
      console.log('API Key:', result[0].apiKey);
      console.log('Base Currency:', result[0].base_currency);
    } else {
      console.log('No API key found for company 38');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

getApiKey();
