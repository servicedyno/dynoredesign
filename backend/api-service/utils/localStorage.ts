import { JsonDB, Config } from "node-json-db";

const localStorage = new JsonDB(new Config("localStorage", true, false, "/"));

export default localStorage;
