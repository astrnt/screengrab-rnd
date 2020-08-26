/**
 * basic server using Express
 */
const bodyParser = require('body-parser');
const express = require('express');
const multer = require('multer');
const upload = multer({dest: 'uploads/'});

const port = 3210;

// create Express instance
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('public'));

// basic API endpoint
app.get('/api/v1', (_, res) => {
  res.json({status: 'OK', message: 'Hello world'});
});

// handle bitmap sent from frontend
app.post('/api/v1/upload', upload.single('screengrab'), (req, res, next) => {
  if (!req.file) {
    const error = new Error('Please upload a file');
    error.httpStatusCode = 400;
    return next(error);
  } else {
    res.send({message: 'file received'});
    console.log(req.file);
    console.log(req.body.screengrabstamp);
  }
});

app.listen(port, () => {
  console.log(`server running at port ${port}`);
});