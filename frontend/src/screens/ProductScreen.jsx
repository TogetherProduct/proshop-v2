import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Row,
  Col,
  Image,
  ListGroup,
  Card,
  Button,
  Form,
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import {
  useGetProductDetailsQuery,
  useCreateReviewMutation,
  useGetRecommendationsQuery,
} from '../slices/productsApiSlice';
import Rating from '../components/Rating';
import Loader from '../components/Loader';
import Message from '../components/Message';
import Meta from '../components/Meta';
import { addToCart } from '../slices/cartSlice';

const ProductScreen = () => {
  const { id: productId } = useParams();

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [qty, setQty] = useState(1);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const addToCartHandler = () => {
    dispatch(addToCart({ ...product, qty }));
    navigate('/cart');
  };

  const {
    data: product,
    isLoading,
    refetch,
    error,
  } = useGetProductDetailsQuery(productId);

  const {
    data: recommendationsData,
    isLoading: recommendationsLoading,
  } = useGetRecommendationsQuery(productId, {
    skip: !productId,
  });

  const { userInfo } = useSelector((state) => state.auth);

  const [createReview, { isLoading: loadingProductReview }] =
    useCreateReviewMutation();

  const submitHandler = async (e) => {
    e.preventDefault();

    try {
      await createReview({
        productId,
        rating,
        comment,
      }).unwrap();
      refetch();
      toast.success('Review created successfully');
    } catch (err) {
      toast.error(err?.data?.message || err.error);
    }
  };

  return (
    <>
      <Link className='btn btn-light my-3' to='/'>
        Go Back
      </Link>
      {isLoading ? (
        <Loader />
      ) : error ? (
        <Message variant='danger'>
          {error?.data?.message || error.error}
        </Message>
      ) : (
        <>
          <Meta title={product.name} description={product.description} />
          <Row>
            <Col md={6}>
              <Image src={product.image_url} alt={product.name} fluid />
            </Col>
            <Col md={3}>
              <ListGroup variant='flush'>
                <ListGroup.Item>
                  <h3>{product.product_name}</h3>
                  <h3>{product.product_category_name}</h3>
                </ListGroup.Item>
                <ListGroup.Item>
                  <Rating
                    value={product.rating}
                    text={`${product.numReviews} reviews`}
                  />
                </ListGroup.Item>
                <ListGroup.Item>Price: ${product.price}</ListGroup.Item>
                <ListGroup.Item>
                  Description: {product.description}
                </ListGroup.Item>
              </ListGroup>
            </Col>
            <Col md={3}>
              <Card>
                <ListGroup variant='flush'>
                  <ListGroup.Item>
                    <Row>
                      <Col>Price:</Col>
                      <Col>
                        <strong>${product.price}</strong>
                      </Col>
                    </Row>
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <Row>
                      <Col>Status:</Col>
                      <Col>
                        {product.countInStock > 0 ? 'In Stock' : 'Out Of Stock'}
                      </Col>
                    </Row>
                  </ListGroup.Item>

                  {/* Qty Select */}
                  {product.countInStock > 0 && (
                    <ListGroup.Item>
                      <Row>
                        <Col>Qty</Col>
                        <Col>
                          <Form.Control
                            as='select'
                            value={qty}
                            onChange={(e) => setQty(Number(e.target.value))}
                          >
                            {[...Array(product.countInStock).keys()].map(
                              (x) => (
                                <option key={x + 1} value={x + 1}>
                                  {x + 1}
                                </option>
                              )
                            )}
                          </Form.Control>
                        </Col>
                      </Row>
                    </ListGroup.Item>
                  )}

                  <ListGroup.Item>
                    <Button
                      className='btn-block'
                      type='button'
                      disabled={product.countInStock === 0}
                      onClick={addToCartHandler}
                    >
                      Add To Cart
                    </Button>
                  </ListGroup.Item>
                </ListGroup>
              </Card>
            </Col>
          </Row>
          <Row className='review'>
            <Col md={6}>
              {/* <h2>Reviews</h2> */}
              {/* {product.reviews.length === 0 && <Message>No Reviews</Message>} */}
              <ListGroup variant='flush'>
                {/* {product.reviews.map((review) => (
                  <ListGroup.Item key={review._id}>
                    <strong>{review.name}</strong>
                    <Rating value={review.rating} />
                    <p>{review.createdAt.substring(0, 10)}</p>
                    <p>{review.comment}</p>
                  </ListGroup.Item>
                ))} */}
                <ListGroup.Item>
                  <h2>Write a Customer Review</h2>

                  {loadingProductReview && <Loader />}

                  {userInfo ? (
                    <Form onSubmit={submitHandler}>
                      <Form.Group className='my-2' controlId='rating'>
                        <Form.Label>Rating</Form.Label>
                        <Form.Control
                          as='select'
                          required
                          value={rating}
                          onChange={(e) => setRating(e.target.value)}
                        >
                          <option value=''>Select...</option>
                          <option value='1'>1 - Poor</option>
                          <option value='2'>2 - Fair</option>
                          <option value='3'>3 - Good</option>
                          <option value='4'>4 - Very Good</option>
                          <option value='5'>5 - Excellent</option>
                        </Form.Control>
                      </Form.Group>
                      <Form.Group className='my-2' controlId='comment'>
                        <Form.Label>Comment</Form.Label>
                        <Form.Control
                          as='textarea'
                          row='3'
                          required
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                        ></Form.Control>
                      </Form.Group>
                      <Button
                        disabled={loadingProductReview}
                        type='submit'
                        variant='primary'
                      >
                        Submit
                      </Button>
                    </Form>
                  ) : (
                    <Message>
                      Please <Link to='/login'>sign in</Link> to write a review
                    </Message>
                  )}
                </ListGroup.Item>
              </ListGroup>
            </Col>
          </Row>
        </>
      )}

      {/* Recommended Products Section */}
      {product && !isLoading && (
        <div className='my-5'>
          <h2>Recommended Products</h2>
          {recommendationsLoading ? (
            <Loader />
          ) : recommendationsData?.recommendations?.length > 0 ? (
            <Row>
              {recommendationsData.recommendations.map((rec) => (
                <Col key={rec.productId} sm={12} md={6} lg={4} xl={3} className='my-3'>
                  <Card className='h-100'>
                    <Card.Img
                      variant='top'
                      src={rec.productDetails?.image_url || '/images/sample.jpg'}
                      alt={rec.productDetails?.product_name || 'Product'}
                      style={{ height: '200px', objectFit: 'cover' }}
                    />
                    <Card.Body>
                      <Card.Title className='text-truncate' style={{ height: '50px' }}>
                        {rec.productDetails?.product_name || 'Unknown Product'}
                      </Card.Title>
                      <Card.Text className='text-muted small'>
                        {rec.productDetails?.product_category_name}
                      </Card.Text>
                      {rec.productDetails?.rating > 0 && (
                        <Rating value={rec.productDetails.rating} />
                      )}
                      <Card.Text className='my-2'>
                        <strong>${rec.productDetails?.price || 0}</strong>
                      </Card.Text>
                      <Card.Text>
                        <small className='text-muted'>
                          <strong>Similarity:</strong> {rec.score?.toFixed(4) || 'N/A'}
                        </small>
                      </Card.Text>
                      <Card.Text>
                        <small className='text-info'>
                          <strong>Method:</strong> {rec.method?.split('(')[0].trim()}
                        </small>
                      </Card.Text>
                      <Link to={`/product/${rec.productId}`} style={{ textDecoration: 'none' }}>
                        <Button variant='primary' size='sm' className='w-100'>
                          View Details
                        </Button>
                      </Link>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Message>No recommendations available for this product</Message>
          )}
          {recommendationsData?.source && (
            <p className='text-muted small mt-3'>
              Data source: <strong>{recommendationsData.source}</strong>
              {recommendationsData.cached && ' (cached)'}
            </p>
          )}
        </div>
      )}
    </>
  );
};

export default ProductScreen;
