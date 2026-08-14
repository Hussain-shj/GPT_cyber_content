import React from "react";
import {Composition} from "remotion";
import {CyberAlertVideo} from "./video.jsx";

export const Root = () => <Composition
  id="CyberAlertVideo"
  component={CyberAlertVideo}
  width={1080}
  height={1920}
  fps={30}
  durationInFrames={900}
  defaultProps={{script:{videoTitle:"تنبيه سيبراني",estimatedDuration:30,scenes:[]},audioDataUri:"",aiClipDataUris:[]}}
  calculateMetadata={({props}) => ({durationInFrames:Math.min(1770, Math.max(90, Math.ceil((props.script?.estimatedDuration || 30) * 30)))})}
/>;
