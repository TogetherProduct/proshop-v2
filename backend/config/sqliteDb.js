import { DataSource } from "typeorm";
import Seller from "../models/sellerModel.js"; 
import productSQL from "../models/productSQLModel.js";



const AppDataSource = new DataSource({
  type: "better-sqlite3",
  database: "data/sqlite.db",
  synchronize: true, 
  logging: true,
  entities: [Seller, productSQL],
});

const connectSQLite = async () => {
  try {
    await AppDataSource.initialize();
    console.log("SQLite database connected via TypeORM");
  } catch (error) {
    console.error("SQLite connection error:", error);
    process.exit(1);
  }
};

export { AppDataSource, connectSQLite };