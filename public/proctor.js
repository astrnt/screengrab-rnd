/**
 * Proctor class
 */
function Proctor (grabScale) {
  // TMP TEST
  const videoPlayer = document.querySelector("#videoElementTest");

  // window is on focus
  this.focused = true;
  // proctoring in progress
  this.inProgress = false;

  let focusLog = [],
      recorder,
      umRecorder,
      stream,
      um,
      capturedScreenBitmaps = [];

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

  /**
   * set the bitmap scale down value
   * eg. if the screenshot is 1000 by 800 pixels, the saved bitmap will be resized to 1000/this.grabScale by 800/this.grabScale pixels
   */
  this.grabScale = grabScale || 1;

  /**
   * grab a particular bitmap from the ongoing stream
   */
  this.capture = async (qid, random = true, maxLimit = 5000) => {
    // get track
    const track = stream.getVideoTracks() && stream.getVideoTracks()[0];

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
    capturedScreenBitmaps.push({'qid': qid, 'bitmap': bitmap, 'focused': this.focused, 'timeOfGrab': tog});
  };

  /**
   * start the process of recording the desktop
   */
  this.start = async () => {
    // start screen stream
    try {
      stream = await navigator.mediaDevices.getDisplayMedia(gdmOptions);
      recorder = new MediaRecorder(stream);
  
      const display = stream.getVideoTracks()[0].getSettings().displaySurface;
      if (display !== 'monitor') { // ['monitor', 'window', 'browser']
        // stop the stream, prevent mem leak
        stream.getVideoTracks()[0].stop();
        
        alert('Please choose entire screen (monitor) for sharing to start the session');
        return;
      } else {
        // proctoring now in progress
        this.inProgress = true;

        // prepare stream chunks
        const chunks = [];
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = this.onRecordingStop(chunks);
        recorder.start();
      }
  
    } catch(err) {
      alert('Please choose a screen and click "Share" to continue.');
    }

    // start audio/video recording
    um = navigator.mediaDevices.getUserMedia(gumOptions).then(umHandler);
  }

  /**
   * callback function for when the recording is stopped
   * @param {*} chunks 
   */
  this.onRecordingStop = chunks => () => {
    // proctoring has stopped
    this.inProgress = false;

    // get video data
    // this can also be included in the session data
    const completeBlob = new Blob(chunks, { type: chunks[0].type });

    // save proctor log
    this.postLog();
    // save proctor result
    
    // loop over the bitmaps, 
    // and then post it to the server
    capturedScreenBitmaps.map(({qid, bitmap, focused, timeOfGrab}) => this.prepareResult(qid, bitmap, focused, timeOfGrab));
  };

  /**
   * prepare the result to send to server
   * mainly create image files from bitmap data
   */
  this.prepareResult = (qid, bitmap, focused, timeOfGrab) => {
    const canvas = document.createElement('canvas');
    
    //set dimension
    const previewWidth = bitmap.width / this.grabScale;
    const previewHeight = bitmap.height / this.grabScale;
    canvas.width = previewWidth;
    canvas.height = previewHeight;

    // draw
    const context = canvas.getContext('2d');
    // draw bitmap
    context.drawImage(bitmap, 0, 0, previewWidth, previewHeight);

    // upload the blob
    canvas.toBlob(this.postBitmapResult(qid, focused, timeOfGrab));
  }

  /**
   * upload captured bitpmaps to server
   */
  this.postLog = () => {
    let xhr = new XMLHttpRequest();

    // send ajax to backend
    xhr.open('POST', 'http://localhost:3210/api/v1/uploadlog', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({focuslog: focusLog}));
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

  /**
   * upload captured bitpmaps to server
   */
  this.postBitmapResult = (qid, focused, timeOfGrab) => blob => {
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
   * stop the process of recording the desktop
   */
  this.stop = () => {
    recorder.stop();
    // stop the stream, prevent mem leak
    stream.getVideoTracks()[0].stop();

    // stop user media stream
    umRecorder.stop();
  }

  // check window gain focus event
  window.onfocus = () => {
    if (this.inProgress) {
      this.focused = true;
      
      const d = new Date();
      const t = d.toISOString().slice(0, 19).replace('T', ' ');
      
      focusLog.push({inFocus: true, ts: t});
    }
  };

  // check window lost focus event
  window.onblur = () => {
    if (this.inProgress) {
      this.focused = false;
      
      const d = new Date();
      const t = d.toISOString().slice(0, 19).replace('T', ' '); 
      
      focusLog.push({inFocus: false, ts: t});
    }
  };

  /**
   * handle the camera/microphone initialization
   * @param {} stream 
   */
  const umHandler = stream => {
    // TMP
    // videoPlayer.src = URL.createObjectURL(stream);

    const options = {mimeType: 'audio/webm'};
    const recordedChunks = [];
    umRecorder = new MediaRecorder(stream, options);

    umRecorder.ondataavailable = e => recordedChunks.push(e.data);
    umRecorder.onstop = () => {
      const soundData = new Blob(recordedChunks);
      // console.log(soundData);
      // test temporary
      const audioUrl = URL.createObjectURL(soundData);
      const audio = new Audio(audioUrl);
      audio.play();

      let xhr = new XMLHttpRequest(), fd = new FormData();
      // create form data
      fd.append('audiograb', soundData);

      // send ajax to backend
      xhr.open('POST', 'http://localhost:3210/api/v1/uploadaudio', true);
      xhr.send(fd);
      xhr.onload = () => {
        // handle error
        if (xhr.status != 200) return;

        // todo
        // get the response from xhr.response
      };
      
      console.log('sound is ready');
    };

    umRecorder.start();
  }

  // end of function
};
