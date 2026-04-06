import { EntitySchema } from "typeorm";

const productSQL = new EntitySchema({
  name: "Product",
  tableName: "products", // The table name in SQLite
  columns: {
    product_id: {
      primary: true,
      type: "varchar",
    },
    product_category_name: {
      type: "varchar",
      nullable: true,
    },
    product_name_lenght: {
      type: "int",
      nullable: true,
    },
    product_description_lenght: {
      type: "int",
      nullable: true,
    },
    product_photos_qty: {
      type: "int",
      nullable: true,
    },
    product_weight_g: {
      type: "int",
      nullable: true,
    },
    product_length_cm: {
      type: "int",
      nullable: true,
    },
    product_height_cm: {
      type: "int",
      nullable: true,
    },
    product_width_cm: {
      type: "int",
      nullable: true,
    },
    price: {
      type: "float", 
      nullable: true,
    },
    product_name: {
      type: "varchar",
      nullable: true,
    },
    image_url: {
      type: "varchar",
      nullable: true,
    }
  }
});

export default productSQL;