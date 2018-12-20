const nodemailer = require('nodemailer');

module.exports = {
  transporter: nodemailer.createTransport({
    host: 'smtp.ukr.net',
    port: 465,
    secure: true, // secure:true for port 465, secure:false for port 587
    auth: {
      user: 'aquacool@ukr.net',
      pass: 'magic128forest19'
    }
  })
}
