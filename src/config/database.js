//const pgp = require('pg-promise')();
import 'dotenv/config'; 
import pgPromise from 'pg-promise';
const pgp = pgPromise({});
const connectionString = {
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASS
}
const db = pgp(connectionString);
//module.exports = db;
export{db};
export default db;