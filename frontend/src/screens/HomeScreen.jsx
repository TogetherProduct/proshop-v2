import { Row, Col } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import { useGetProductsByIdsQuery } from '../slices/productsApiSlice';
import { useGetClusterQuery } from '../slices/clusterSlice';

import { Link } from 'react-router-dom';
import Product from '../components/Product';
import Loader from '../components/Loader';
import Message from '../components/Message';
import Paginate from '../components/Paginate';
import ProductCarousel from '../components/ProductCarousel';
import Meta from '../components/Meta';
import { useDispatch, useSelector } from 'react-redux';

const HomeScreen = () => {
  const { userInfo } = useSelector((state) => state.auth);

  const userId = userInfo?._id;

  const { data: clusterData } = useGetClusterQuery(userId, {
    skip: !userId,
  });
  const { pageNumber = 1, keyword } = useParams();

  // Convert pageNumber to integer (it comes as string from URL)
  const currentPage = parseInt(pageNumber) || 1;

  const { data, isLoading: isNotLoggedInProductsLoading, error: isNotLoggedInProductsError } = useGetProductsQuery({
    keyword,
    pageNumber: currentPage,
  });


  const productsObj = clusterData?.products || {};
  const productIds = Object.keys(productsObj).slice(0, 20);

  const {
    data: products = [],
    isLoading,
    error,
  } = useGetProductsByIdsQuery(productIds, {
    skip: productIds.length === 0,
  });


  return (
    <>
      {!keyword ? (
        <ProductCarousel />
      ) : (
        <Link to='/' className='btn btn-light mb-4'>
          Go Back
        </Link>
      )}
      {isLoading ? (
        <Loader />
      ) : error ? (
        <Message variant='danger'>
          {error?.data?.message || error.error}
        </Message>
      ) : (
        <>
          <Meta />

          {
            userId ?
              <>
                <h1>Recommended For You</h1>
                {
                  products.length > 0 ? (
                    <Row>
                      {products.map((product) => (
                        <Col key={product._id} sm={12} md={6} lg={4} xl={3}>
                          <Product product={product} />
                        </Col>
                      ))}
                    </Row>
                  ) : (
                    <Message>No products found</Message>
                  )
                }
              </> :
              <>
                <h1>Latest Products</h1>
                <Row>
                  {data.products.map((product) => (
                    <Col key={product._id} sm={12} md={6} lg={4} xl={3}>
                      <Product product={product} />
                    </Col>
                  ))}
                </Row>
              </>
          }
          <Paginate
            pages={data.pages}
            page={data.page || currentPage}
            keyword={keyword ? keyword : ''}
          />
        </>
      )}
    </>
  );
};

export default HomeScreen;
