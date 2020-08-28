# screengrab-rnd
R&amp;D for screen grabbing functionalities on the browser.

## How to install
1. Run `npm install` to install the dummy server 
2. Run `npm start` to run the dummy server
3. Open `http://localhost:3210/demo.html` on the browser to check the demo

## How to use the library

### Initialisation
1. Include the proctoring library on the HTML file. In the future we will store this file in Astronaut's public CDN.
`<script src="proctor.js"></script>`

2. Initialize the proctor class. Example:
`const proctor = new Proctor();`

### Start the proctoring process
Trigger the start of the proctoring process by calling this method:
`proctor.start();`

### Take screenshot
To take a screenshot, use this method:
`proctor.capture(qid, random, maxLimit);`
This method takes three parameters. 

1. `qid`: Mandatory parameter for passing the question's id.
2. `random`: Optional parameter, default value is `true`. If set to `false`, the screenshot will be taken immediately. 
3. `maxLimit`: Optional paramater, default value is `5000`. Max time limit in milliseconds of when the screenshot is taken after the method is called.

### Stop the proctoring process
To stop of the proctoring process:
`proctor.stop();`

## Proctor result
There are three types (with the current iteration) of result stored on the backend. All of the files are stored on the `/uploads` directory.

### Screenshot
Screenshot of the user's screen during the session, stored as PNG files.

### Audio recording
Ambient sound recording during the session, stored as a raw audio file.

### Activity log
A log of the browser activity (getting in and out of the session's browser tab) during the session, stored as CSV. 
Example:
```
Timestamp,Tab is in focus
2020-08-28 02:21:15,true
2020-08-28 02:21:38,false
2020-08-28 02:21:57,true
2020-08-28 02:21:58,false
```