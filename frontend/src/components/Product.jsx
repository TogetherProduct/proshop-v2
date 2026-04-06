import { Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Rating from './Rating';

const Product = ({ product }) => {
  return (
    <Card className='my-3 p-3 rounded'>
      <Link to={`/product/${product.product_id}`}>
        <Card.Img src={product.image_url} variant='top' />
      </Link>

      <Card.Body>
        <Link to={`/product/${product.product_id}`}>
        {/* <Link to={`/api/sql-products/${product.product_id}`}> */}
          <Card.Title as='div' className='product-title'>
            <strong>{product.product_name}</strong>
          </Card.Title>
        </Link>
        <strong>{product.product_category_name}</strong>

        <Card.Text as='div'>
          <Rating
            // value={product.rating}
            text={`${0} reviews`}
          />
        </Card.Text>

        <Card.Text as='h3'>${product.price}</Card.Text>
      </Card.Body>
    </Card>
  );
};

export default Product;