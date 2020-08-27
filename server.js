/**
 * basic server using Express
 */
const bodyParser = require('body-parser');
const express = require('express');
const multer = require('multer');
const upload = multer({dest: 'uploads/'});
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');

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
    res.json({message: 'file received'});
    console.log(req.file);
    console.log(req.body.screengrabstamp);
  }
});

// handle log sent from backend
app.post('/api/v1/uploadlog', (req, res) => {
  const {focuslog} = req.body;

  const csvWriter = createCsvWriter({
    path: 'uploads/log.csv',
    header: [
      {id: 'ts', title: 'Timestamp'},
      {id: 'inFocus', title: 'Tab is in focus'}
    ]
  });

  csvWriter
  .writeRecords(focuslog)
  .then(() => res.json({message: 'log received'}));
});

app.listen(port, () => {
  console.log(`server running at port ${port}`);
});