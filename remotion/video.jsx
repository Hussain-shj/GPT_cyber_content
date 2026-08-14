import React from "react";
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {Audio} from "@remotion/media";

const palette = {navy:"#020a14", blue:"#0a84ff", cyan:"#1bd3cf", white:"#f4f9ff", muted:"#9eb2c9"};

const BackgroundEffects = () => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background:`radial-gradient(circle at ${30 + (frame % 90) / 3}% 30%,#0a3a6688,transparent 35%),linear-gradient(160deg,#02070d,#061a2d 58%,#02070d)`,overflow:"hidden"}}>
    <div style={{position:"absolute",inset:0,opacity:.16,backgroundImage:"linear-gradient(#1bd3cf55 1px,transparent 1px),linear-gradient(90deg,#1bd3cf55 1px,transparent 1px)",backgroundSize:"72px 72px",transform:`translateY(${frame % 72}px)`}} />
    <div style={{position:"absolute",left:-180,top:280,width:520,height:520,border:`3px solid ${palette.blue}55`,borderRadius:"50%",boxShadow:`0 0 100px ${palette.blue}44`}} />
  </AbsoluteFill>;
};

const Scene = ({scene, index}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame,fps,config:{damping:16,stiffness:110}});
  const scan = interpolate(frame,[0,90],[0,1],{extrapolateRight:"clamp"});
  const label = scene.type === "action" ? "الإجراء المطلوب" : scene.type === "intro" ? "نبض سيبراني" : "تنبيه سيبراني";
  return <AbsoluteFill style={{direction:"rtl",fontFamily:"Cairo,Arial,sans-serif",color:palette.white,padding:"190px 92px 260px",justifyContent:"center",textAlign:"right"}}>
    <div style={{color:palette.cyan,fontSize:34,fontWeight:800,marginBottom:34,opacity:enter,letterSpacing:1}}>{label}</div>
    <div style={{fontSize:76,fontWeight:900,lineHeight:1.35,transform:`translateY(${(1-enter)*70}px) scale(${.94 + enter*.06})`,opacity:enter,textShadow:"0 8px 36px #000"}}>{scene.onScreenText}</div>
    <div style={{width:`${scan*100}%`,height:7,marginTop:46,background:`linear-gradient(90deg,${palette.cyan},${palette.blue})`,borderRadius:8,boxShadow:`0 0 24px ${palette.cyan}`}} />
    <div style={{position:"absolute",right:92,bottom:155,left:92,color:palette.white,fontSize:38,fontWeight:700,lineHeight:1.55,textAlign:"center",background:"#020b16dd",border:`1px solid ${palette.cyan}66`,padding:"22px 30px",borderRadius:18}}>{scene.voiceText}</div>
    <div style={{position:"absolute",top:70,right:78,fontSize:30,fontWeight:900,color:palette.white}}>نبض سيبراني <span style={{color:palette.cyan}}>| CYBER PULSE</span></div>
    <div style={{position:"absolute",bottom:72,right:92,left:92,height:8,background:"#ffffff22",borderRadius:10}}><div style={{height:"100%",width:`${((index+1)/6)*100}%`,maxWidth:"100%",background:palette.cyan,borderRadius:10}} /></div>
  </AbsoluteFill>;
};

export const CyberAlertVideo = ({script,audioDataUri}) => {
  let start = 0;
  return <AbsoluteFill style={{background:palette.navy}}>
    <BackgroundEffects />
    {audioDataUri ? <Audio src={audioDataUri} /> : null}
    {(script.scenes || []).map((scene,index) => {
      const duration = Math.max(75, Math.round((scene.duration || 5) * 30));
      const item = <Sequence key={scene.id || index} from={start} durationInFrames={duration}><Scene scene={scene} index={index} /></Sequence>;
      start += duration;
      return item;
    })}
  </AbsoluteFill>;
};
