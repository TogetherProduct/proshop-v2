import { Pagination } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const Paginate = ({ pages, page, isAdmin = false, keyword = '' }) => {
  const navigate = useNavigate();

  // Smart pagination: Show only 5-7 page buttons + ellipsis
  const getPageNumbers = () => {
    const maxPagesToShow = 5; // Number of page buttons to show
    const pageNumbers = [];

    if (pages <= maxPagesToShow) {
      // If total pages <= max to show, show all
      for (let i = 1; i <= pages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Show smart pagination with ellipsis
      const leftSiblings = Math.max(page - 2, 1);
      const rightSiblings = Math.min(page + 2, pages);

      // Always show first page
      pageNumbers.push(1);

      // Add left ellipsis
      if (leftSiblings > 2) {
        pageNumbers.push('...');
      }

      // Add pages around current page
      for (let i = leftSiblings; i <= rightSiblings; i++) {
        if (i !== 1 && i !== pages) {
          pageNumbers.push(i);
        }
      }

      // Add right ellipsis
      if (rightSiblings < pages - 1) {
        pageNumbers.push('...');
      }

      // Always show last page
      if (pages > 1) {
        pageNumbers.push(pages);
      }
    }

    return pageNumbers;
  };

  const handlePageClick = (pageNum) => {
    if (!isAdmin) {
      if (keyword) {
        navigate(`/search/${keyword}/page/${pageNum}`);
      } else {
        navigate(`/page/${pageNum}`);
      }
    } else {
      navigate(`/admin/productlist/${pageNum}`);
    }
  };

  return (
    pages > 1 && (
      <Pagination className='justify-content-center my-3'>
        {/* Previous Button */}
        {page > 1 && (
          <Pagination.Prev
            onClick={() => handlePageClick(page - 1)}
            style={{ cursor: 'pointer' }}
          />
        )}

        {/* Page Numbers */}
        {getPageNumbers().map((pageNum, index) => {
          if (pageNum === '...') {
            return (
              <Pagination.Ellipsis
                key={`ellipsis-${index}`}
                disabled
              />
            );
          }

          return (
            <Pagination.Item
              key={pageNum}
              active={pageNum === page}
              onClick={() => handlePageClick(pageNum)}
              style={{ cursor: pageNum === page ? 'default' : 'pointer' }}
            >
              {pageNum}
            </Pagination.Item>
          );
        })}

        {/* Next Button */}
        {page < pages && (
          <Pagination.Next
            onClick={() => handlePageClick(page + 1)}
            style={{ cursor: 'pointer' }}
          />
        )}
      </Pagination>
    )
  );
};

export default Paginate;
