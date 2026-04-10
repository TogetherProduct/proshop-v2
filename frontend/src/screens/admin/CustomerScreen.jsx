import { useEffect, useState } from 'react';
import { Row, Col, Card, ListGroup, Modal, Button, Badge } from 'react-bootstrap';
import Loader from '../../components/Loader';
import Message from '../../components/Message';
import { useGetCustomerSegmentsQuery } from '../../slices/customerApiSlice';

// Import from react-chartjs-2
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, PieController } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

// Register plugins
ChartJS.register(ArcElement, Tooltip, Legend, PieController, ChartDataLabels);

const COLORS = ['#00C49F', '#0088FE', '#FF8042'];

const CustomerScreen = () => {
  const { data, isLoading, error, refetch } = useGetCustomerSegmentsQuery();
  const [selectedSegmentName, setSelectedSegmentName] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    refetch();
  }, [refetch]);

  if (isLoading) return <Loader />;
  if (error) return <Message variant='danger'>{error?.data?.message || "Lỗi tải dữ liệu"}</Message>;

  // 1. Calculate totals safely
  const vipCount = data?.Vip?.length || 0;
  const normalCount = data?.Normal?.length || 0;
  const lowCount = data?.Low?.length || 0;
  const total = vipCount + normalCount + lowCount;

  // 2. Define Chart Data
  const chartData = {
    labels: ['Vip', 'Normal', 'Low'],
    datasets: [{
      data: [vipCount, normalCount, lowCount],
      backgroundColor: COLORS,
      hoverOffset: 25,
      borderWidth: 2,
      borderColor: '#ffffff',
    }]
  };

  // 3. Define Chart Options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { padding: 20, font: { size: 14 } }
      },
      datalabels: {
        color: '#fff',
        font: { weight: 'bold', size: 16 },
        formatter: (value) => {
          if (total === 0) return "0%";
          return ((value / total) * 100).toFixed(1) + "%";
        },
        display: (context) => context.dataset.data[context.dataIndex] > 0
      },
      tooltip: {
        callbacks: {
          label: (context) => `Số lượng: ${context.raw}`
        }
      }
    },
    onClick: (event, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const segments = ['Vip', 'Normal', 'Low'];
        setSelectedSegmentName(segments[index]);
        setShowModal(true);
      }
    }
  };

  // Cấu hình Voucher hiển thị TO và RÕ
  const config = {
    Vip: { 
      label: 'KHÁCH HÀNG THÂN THIẾT (VIP)', 
      color: COLORS[0], 
      voucher: 'GIẢM TRỰC TIẾP 15%', 
      subInfo: 'Đặc quyền giảm giá mọi hóa đơn' 
    },
    Normal: { 
      label: 'KHÁCH HÀNG BÌNH THƯỜNG', 
      color: COLORS[1], 
      voucher: 'TẶNG VOUCHER 50K', 
      subInfo: 'Áp dụng cho đơn hàng kế tiếp' 
    },
    Low: { 
      label: 'KHÁCH HÀNG NGUY CƠ RỜI BỎ', 
      color: COLORS[2], 
      voucher: 'GIẢM 5% + QUÀ TẶNG', 
      subInfo: 'Ưu đãi tri ân đặc biệt' 
    },
  };

  const safeRender = (val) => {
    if (!val) return "";
    if (typeof val === 'object') return val._id || JSON.stringify(val);
    return String(val);
  };

  return (
    <div className="container-fluid py-4">
      <h1 className="mb-5 text-center fw-bold text-uppercase" style={{ letterSpacing: '2px' }}>
        Phân loại khách hàng & Ưu đãi
      </h1>

      <Row className="gy-5">
        {/* CỘT 1: BIỂU ĐỒ TRÒN CÓ PHẦN TRĂM */}
        <Col lg={5} md={12} className="d-flex flex-column align-items-center justify-content-center">
          <div style={{ height: '400px', width: '100%', maxWidth: '450px' }}>
           {total === 0 ? (
              <span className="text-muted fw-bold">Chưa có dữ liệu khách hàng</span>
            ) : (
<Pie 
                // 1. Tạo key động: Bất cứ khi nào số lượng thay đổi, React sẽ XÓA canvas cũ và tạo mới
                key={`pie-chart-${vipCount}-${normalCount}-${lowCount}`} 
                
                // 2. Ép ChartJS phải clear instance cũ đi trước khi vẽ
                redraw={true} 
                
                data={chartData} 
                options={chartOptions} 
              />
            )}
          </div>
          <div className="mt-4 p-3 bg-white rounded shadow-sm border text-center w-75">
            <h5 className="mb-0 text-muted">Tổng số khách hàng</h5>
            <h2 className="fw-bold text-primary">
              {(data.Vip?.length || 0) + (data.Normal?.length || 0) + (data.Low?.length || 0)}
            </h2>
          </div>
        </Col>

        {/* CỘT 2: DANH SÁCH VOUCHER TICKET */}
        <Col lg={7} md={12}>
          {Object.keys(config).map((key) => (
            <Card key={key} className="mb-4 shadow-sm border-0 overflow-hidden" style={{ borderRadius: '15px' }}>
              <Row className="g-0">
                {/* Phần cuống vé Voucher */}
                <Col xs={4} className="d-flex align-items-center justify-content-center text-white" 
                     style={{ backgroundColor: config[key].color, borderRight: '2px dashed rgba(255,255,255,0.5)' }}>
                  <div className="text-center p-3">
                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '1px' }}>VOUCHER</div>
                    <hr className="my-2" style={{ borderTop: '2px solid white' }} />
                    <div style={{ fontSize: '1.3rem', fontWeight: '900', lineHeight: '1.1' }}>
                      {config[key].voucher.split(' ').map((word, i) => <div key={i}>{word}</div>)}
                    </div>
                  </div>
                </Col>
                
                {/* Phần nội dung thông tin */}
                <Col xs={8}>
                  <Card.Body className="d-flex flex-column justify-content-center">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <h5 className="fw-bold mb-0" style={{ color: config[key].color }}>{config[key].label}</h5>
                        <small className="text-muted">{config[key].subInfo}</small>
                      </div>
                      <Button variant="dark" size="sm" className="rounded-pill px-3" 
                              onClick={() => { setSelectedSegmentName(key); setShowModal(true); }}>
                        Chi tiết
                      </Button>
                    </div>
                    
                    <div className="mb-3">
                      <span className="badge bg-light text-dark border py-2 px-3" style={{ fontSize: '0.85rem' }}>
                        Số lượng: <strong>{data?.[key]?.length || 0} khách hàng</strong>
                      </span>
                    </div>

                    <div className="p-2 rounded" style={{ backgroundColor: '#f8f9fa' }}>
                      <div className="small fw-bold text-muted mb-1" style={{ fontSize: '0.7rem' }}>ID THÀNH VIÊN TIÊU BIỂU:</div>
                      {(data?.[key] || []).slice(0, 2).map((item, i) => (
                        <code key={i} className="d-block text-truncate mb-0" style={{ color: '#666', fontSize: '0.8rem' }}>
                          • {safeRender(item.customer_id)}
                        </code>
                      ))}
                    </div>
                  </Card.Body>
                </Col>
              </Row>
            </Card>
          ))}
        </Col>
      </Row>

      {/* MODAL DANH SÁCH ID */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton className="border-0 bg-light">
          <Modal.Title className="fw-bold px-3">Danh sách ID - Nhóm {selectedSegmentName}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          <ListGroup variant="flush">
            {(data?.[selectedSegmentName] || []).map((item, i) => (
              <ListGroup.Item key={i} className="d-flex justify-content-between align-items-center py-3 px-4 border-bottom">
                <div className="d-flex align-items-center">
                  <span className="badge bg-secondary me-3" style={{ width: '30px' }}>{i + 1}</span>
                  <span className="font-monospace fw-bold" style={{ fontSize: '1rem' }}>{safeRender(item.customer_id)}</span>
                </div>
                <Badge bg="success" pill>Thành viên</Badge>
              </ListGroup.Item>
            ))}
            {(data?.[selectedSegmentName]?.length === 0) && (
              <div className="text-center py-5 text-muted">Không có dữ liệu cho nhóm này.</div>
            )}
          </ListGroup>
        </Modal.Body>
        <Modal.Footer className="border-0 p-3">
          <Button variant="secondary" onClick={() => setShowModal(false)} className="px-4">Đóng</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CustomerScreen;