import bcrypt from 'bcryptjs';

const users = [
  {
    _id: '4a3ca9315b744ce9f8e9374361493884',
    name: 'Admin User',
    email: 'admin@email.com',
    password: bcrypt.hashSync('123456', 10),
    isAdmin: true,
    city: 'A',
    state: 'B'
  }
];

export default users;
