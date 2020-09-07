/**
 * Proctor class
 * @param {integer} grabScale 
 * set the bitmap scale down value
 * eg. if the screenshot is 1000 by 800 pixels, the saved bitmap will be resized to 1000/grabScale by 800/grabScale pixels
 */
function Proctor (grabScale = 1) {
  // TMP TEST
  // const videoPlayer = document.querySelector("#videoElementTest");

  // window is on focus
  let focused = true;
  // proctoring in progress
  let inProgress = false;

  let focusLog = [],
      scRecorder,
      umRecorder,
      scStream,
      umStream,
      capturedScreenBitmaps = [],
      capturedCamBitmaps = [];

  /**
   * set display media options
   */
  const gdmOptions = {
    video: {
      mediaSource: 'screen',
      cursor: 'always'
    },
    audio: false,
    logicalSurface: true,
    displaySurface: 'monitor'
  };

  /**
   * set user media options
   */
  const gumOptions = {
    video: true,
    audio: true
  };

  // -----------------------------------------------------
  // Starting and stopping proctoring

  /**
   * start the process of recording the desktop
   */
  this.start = async () => {
    // start screen stream
    try {
      scStream = await navigator.mediaDevices.getDisplayMedia(gdmOptions);
      scRecorder = new MediaRecorder(scStream);
  
      const display = scStream.getVideoTracks()[0].getSettings().displaySurface;
      if (display !== 'monitor') { // ['monitor', 'window', 'browser']
        // stop the stream, prevent mem leak
        scStream.getVideoTracks()[0].stop();
        
        alert('Please choose entire screen (monitor) for sharing to start the session');
        return;
      } else {
        // proctoring now in progress
        inProgress = true;

        // prepare stream chunks
        const chunks = [];
        scRecorder.ondataavailable = e => chunks.push(e.data);
        scRecorder.onstop = onScreenRecordingStop(chunks);
        scRecorder.start();
      }
  
    } catch(err) {
      alert('Please choose a screen and click "Share" to continue.');
    }

    // start audio/video recording
    try {
      navigator.mediaDevices.getUserMedia(gumOptions).then(umHandler);
    } catch(err) {
      alert('Your media device cannot be accessed.');
    }
  }

  /**
   * stop the process of recording the desktop
   */
  this.stop = () => {
    scRecorder.stop();
    // stop the stream, prevent mem leak
    scStream.getVideoTracks()[0].stop();

    // stop user media stream
    umRecorder.stop();
    // stop the stream, prevent mem leak
    umStream.getVideoTracks()[0].stop();
  }

  // -----------------------------------------------------
  // Screen grabbing methods

  /**
   * grab a particular bitmap from the ongoing stream
   * @param {string} qid
   * @param {boolean} random
   * @param {integer} maxLimit
   */
  this.capture = async (qid, random = true, maxLimit = 5000) => {
    // get track
    const track = scStream.getVideoTracks() && scStream.getVideoTracks()[0];

    // init Image Capture and not Video stream
    const imageCapture = new ImageCapture(track);

    // if randomize the screen capture time is true, wait for a number (< maxLimit) of seconds (aka sleep)
    if (random) await new Promise(r => setTimeout(r, (Math.random() * maxLimit) ));

    // take the current frame
    const bitmap = await imageCapture.grabFrame();
    const d = new Date();
    const tog = d.toISOString().slice(0, 19).replace('T', ' ');
    // todo remove
    console.log(qid, 'grabbed');

    // save it to a temporary array
    capturedScreenBitmaps.push({'qid': qid, 'bitmap': bitmap, 'focused': focused, 'timeOfGrab': tog});

    // snap image right after take screen capture;
    this.snap(qid);
  };

  /**
   * callback function for when the recording is stopped
   * @param {*} chunks 
   */
  const onScreenRecordingStop = chunks => async () => {
    // proctoring has stopped
    inProgress = false;

    // 1. save proctor log
    postLog(this.prepareLog(focusLog));

    // 2. send screen grabs
    // convert the bitmap to blob
    const capturedScreenBlobs = await Promise.all(capturedScreenBitmaps.map(async ({qid, bitmap, focused, timeOfGrab}) => {
      const blob = await prepareBitmapToBlob(bitmap);
      return {'qid': qid, 'blob': blob, 'timeOfGrab': timeOfGrab, 'focused': focused};
    }));
    
    // send the blob to server
    capturedScreenBlobs.forEach(({qid, blob, focused, timeOfGrab}) => sendBlobToServer(qid, blob, focused, timeOfGrab));
  };

  // -----------------------------------------------------
  // Post log

  /**
   * prepare log
   */
  this.prepareLog = flog => {
    return JSON.stringify({focuslog: flog});
  }

  /**
   * upload log
   */
  const postLog = logData => {
    let xhr = new XMLHttpRequest();

    // send ajax to backend
    xhr.open('POST', 'http://localhost:3210/api/v1/uploadlog', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(logData);
    xhr.onload = () => {
      // handle error
      if (xhr.status != 200) {
        alert('Upload failed');
        return;
      };
      // todo
      // get the response from xhr.response
    };
  }

  // -----------------------------------------------------
  // User media methods

  /**
   * handle the camera/microphone initialization
   * @param {} stream 
   */
  const umHandler = stream => {
    umStream = stream;

    // initialize media recorder
    const options = {mimeType: 'audio/webm'};
    const umChunks = [];
    umRecorder = new MediaRecorder(stream, options);

    umRecorder.ondataavailable = e => umChunks.push(e.data);
    umRecorder.onstop = onUmHandlingStop(umChunks);

    umRecorder.start();
  }

  /**
   * Take a snap out of the video stream
   * @param {*} qid 
   */
  this.snap = async qid => {
    // get track
    const track = umStream.getVideoTracks() && umStream.getVideoTracks()[0];

    // init Image Capture and not Video stream
    const imageCapture = new ImageCapture(track);

    // if randomize the screen capture time is true, wait for a number (< maxLimit) of seconds (aka sleep)
    // if (random) await new Promise(r => setTimeout(r, (Math.random() * maxLimit) ));

    // take the current frame
    const bitmap = await imageCapture.grabFrame();
    const d = new Date();
    const tog = d.toISOString().slice(0, 19).replace('T', ' ');

    // todo remove
    console.log(qid, 'snapped');

    // // save it to a temporary array
    capturedCamBitmaps.push({'qid': qid, 'bitmap': bitmap, 'timeOfGrab': tog});
  }

  /**
   * callback function for when the user media recording is stopped
   */
  const onUmHandlingStop = umChunks => async () => {
    // 1. send av chunk
    sendAVStream(umChunks);

    // 2. send av camera captures
    // convert the bitmap to blob
    const capturedCamBlobs = await Promise.all(capturedCamBitmaps.map(async ({qid, bitmap, timeOfGrab}) => {
      const blob = await prepareBitmapToBlob(bitmap);
      return {'qid': qid, 'blob': blob, 'timeOfGrab': timeOfGrab, 'focused': null};
    }));
    
    // send the blob to server
    capturedCamBlobs.forEach(({qid, blob, focused, timeOfGrab}) => sendBlobToServer(qid, blob, focused, timeOfGrab));
  }

  // -----------------------------------------------------
  // Bitmap to blob processing
  // and delivery to server 

  /**
   * send blob to server
   * @param {string} qid
   * @param {boolean} focused
   * @param {string} timeOfGrab
   * @param {blob} blob
   */
  const sendBlobToServer = (qid, blob, focused, timeOfGrab) => {
    let xhr = new XMLHttpRequest(), fd = new FormData();

    // create form data
    fd.append('questionId', qid);
    fd.append('screengrab', blob);
    fd.append('isFocused', focused);
    fd.append('screengrabstamp', timeOfGrab);

    // send ajax to backend
    xhr.open('POST', 'http://localhost:3210/api/v1/upload', true);
    xhr.send(fd);
    xhr.onload = () => {
      // handle error
      if (xhr.status != 200) return;

      // todo
      // get the response from xhr.response
    };
  }

  /** 
   * create images from bitmap data for sending to server
   */
  const prepareBitmapToBlob = async bitmap => {
    const canvas = document.createElement('canvas');
    const previewWidth = bitmap.width / grabScale;
    const previewHeight = bitmap.height / grabScale;
    
    //set dimension
    canvas.width = previewWidth;
    canvas.height = previewHeight;

    // draw
    await canvas
    .getContext('2d')
    .drawImage(bitmap, 0, 0, previewWidth, previewHeight);

    // return the blob
    return await new Promise(resolve => canvas.toBlob(resolve));
  };

  /** 
   * send AV recording data
   */
  const sendAVStream = chunk => {
    const avData = new Blob(chunk);

    let xhr = new XMLHttpRequest(), fd = new FormData();
    // create form data
    fd.append('audiograb', avData);

    // send ajax to backend
    xhr.open('POST', 'http://localhost:3210/api/v1/uploadav', true);
    xhr.send(fd);
    xhr.onload = () => {
      // handle error
      if (xhr.status != 200) return;
      // todo
      // get the response from xhr.response
    };
  }

  // -----------------------------------------------------
  // Checking window focus/blur

  // check window gain focus event
  window.onfocus = () => {
    if (inProgress) this.logFocus(true);
  };

  // check window lost focus event
  window.onblur = () => {
    if (inProgress) this.logFocus(false);
  };

  // store lost focus log
  this.logFocus = status => {
    focused = status;
    
    const d = new Date();
    const t = d.toISOString().slice(0, 19).replace('T', ' '); 
    
    focusLog.push({inFocus: status, ts: t});
  }

  // get focus log value
  this.getFocusLog = () => (focusLog);

  // end of functions ------------------------------------
};
