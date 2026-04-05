import { EntitySchema } from "typeorm";

const Seller = new EntitySchema({
  name: "Seller",
  tableName: "sellers",
  columns: {
    seller_id: {
      primary: true,
      type: "varchar",
    },
    seller_zip_code_prefix: {
      type: "int",
    },
    seller_city: {
      type: "varchar",
    },
    seller_state: {
      type: "varchar",
    }
  }
});

export default Seller;