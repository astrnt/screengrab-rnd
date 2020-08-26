// check whether getDisplayMedia API is available
const canIRun = navigator.mediaDevices.getDisplayMedia;
// record video track
const elapsed = document.getElementById('elapsed');
const previews = document.getElementById('previews');
const secInt = 3; // use 3 seconds as the screen grab inteval
let recorder, stream, s = 0, timer, capturedBitmaps = [], focused = true;

/**
 * set media options
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
 * start the process of recording the desktop
 */
const startRecording = async () => {
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
      // prepare stream chunks
      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = onRecordingStop(chunks);

      recorder.start();

      // start timer
      // grab image with each interval
      timer = timerIntv();
    }

  } catch(err) {
    alert('Please choose a screen and click "Share" to continue.');
  }
}

/** 
 * grab image on x seconds interval
 */
const timerIntv = () => setInterval(() => {
  s++;
  elapsed.innerHTML = s;

  // grab bitmap every three seconds
  if (s % secInt === 0) grabImageFromStream();
}, 1000);

/**
 * handle on stop
 */
const onRecordingStop = chunks => () => {
  // get video data
  // this can also be included in the session data
  const completeBlob = new Blob(chunks, { type: chunks[0].type });

  //show result
  capturedBitmaps.map(({bitmap, focused, timeOfGrab}) => showCaptures(bitmap, focused, timeOfGrab));
};

/**
 * grab bitmap from stream
 */
const grabImageFromStream = async () => {
  // get track
  const track = stream.getVideoTracks() && stream.getVideoTracks()[0];

  // init Image Capture and not Video stream
  const imageCapture = new ImageCapture(track);

  // take the current frame
  const bitmap = await imageCapture.grabFrame();
  const d = new Date();
  const t = d.toISOString().slice(0, 19).replace('T', ' ');

  capturedBitmaps.push({'bitmap': bitmap, 'focused': focused, 'timeOfGrab': t});
}

/**
 * draw screen capture bitmap
 */
const showCaptures = (bitmap, focused, timeOfGrab) => {
  //create container
  const canvasContainer = document.createElement('div');
  //create container for date
  const dateText = document.createElement('p');
  dateText.innerHTML = timeOfGrab;

  // create canvas 
  const canvas = document.createElement('canvas');
  
  //set dimension
  const previewWidth = bitmap.width / 5;
  const previewHeight = bitmap.height / 5;
  canvas.width = previewWidth;
  canvas.height = previewHeight;

  // draw
  const context = canvas.getContext('2d');
  // draw bitmap
  context.drawImage(bitmap, 0, 0, previewWidth, previewHeight);
  
  canvasContainer.appendChild(canvas);
  canvasContainer.appendChild(dateText);
  canvasContainer.setAttribute('style', focused ? 'background: #8BC34A' : 'background: #F44336');

  previews.appendChild(canvasContainer);

  // upload the blob
  canvas.toBlob(uploadBlob(timeOfGrab));
}

// upload the blob image to dummy server
const uploadBlob = timeOfGrab => blob => {
  let xhr = new XMLHttpRequest(), fd = new FormData();

  // create form data
  fd.append('screengrab', blob);
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
};


/**
 * start button action
 */
const startBtn = document.getElementById('start').onclick = e => {
  e.stopImmediatePropagation();
  if (canIRun) startRecording();

}

/**
 * stop button action
 */
const stopBtn = document.getElementById('stop').onclick = () => {
  clearInterval(timer);
  recorder.stop();
  // stop the stream, prevent mem leak
  stream.getVideoTracks()[0].stop();
}

/**
 * check window gain focus event
 */
window.onfocus = () => {
  focused = true;
};

/**
 * check window lost focus event
 */
window.onblur = () => {
  focused = false;
};