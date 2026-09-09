// Original synthesized hold music and Foley keep the prototype self-contained.
export class OceanAudio {
  constructor(){this.context=null;this.volume=.35;this.muted=false;this.beat=0;this.nextBeat=0;}
  start(){if(!this.context){this.context=new AudioContext();this.master=this.context.createGain();this.master.connect(this.context.destination);this.master.gain.value=this.volume*.48;this.nextBeat=this.context.currentTime;this.timer=setInterval(()=>this.scheduleMusic(),100);}this.context.resume();}
  setVolume(value){this.volume=value;this.updateVolume();}
  toggle(){this.muted=!this.muted;this.updateVolume();return this.muted;}
  updateVolume(){if(this.master)this.master.gain.setTargetAtTime(this.muted?0:this.volume*.48,this.context.currentTime,.05);}
  tone(frequency,time,length=.15,volume=.15,type='sine'){
    if(!this.context)return;const oscillator=this.context.createOscillator(),envelope=this.context.createGain();oscillator.type=type;oscillator.frequency.value=frequency;envelope.gain.setValueAtTime(0,time);envelope.gain.linearRampToValueAtTime(volume,time+.008);envelope.gain.exponentialRampToValueAtTime(.001,time+length);oscillator.connect(envelope);envelope.connect(this.master);oscillator.start(time);oscillator.stop(time+length+.02);
  }
  noise(length=.3,volume=.13,frequency=1800){if(!this.context)return;const buffer=this.context.createBuffer(1,this.context.sampleRate*length,this.context.sampleRate);const samples=buffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*(1-i/samples.length);const source=this.context.createBufferSource(),filter=this.context.createBiquadFilter(),gain=this.context.createGain();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=frequency;gain.gain.value=volume;source.connect(filter);filter.connect(gain);gain.connect(this.master);source.start();}
  scheduleMusic(){
    if(this.context.state!=='running')return;
    const phrases=[
      [72,76,79,76,74,71,67,71,69,72,76,72,67,71,74,71],
      [72,74,76,79,77,76,74,71,72,76,81,79,74,71,67,0],
      [76,79,84,79,74,77,81,77,76,72,69,72,71,74,79,0],
      [79,76,74,72,71,67,74,0,69,72,76,79,74,71,72,0],
    ];
    const bass=[48,43,45,43];
    while(this.nextBeat<this.context.currentTime+.25){
      const index=this.beat%16,phrase=phrases[Math.floor(this.beat/16)%phrases.length],time=this.nextBeat;
      if(phrase[index])this.tone(440*2**((phrase[index]-69)/12),time,.23,.075,'sine');
      if(index%4===0){
        const root=bass[Math.floor(index/4)];
        this.tone(440*2**((root-69)/12),time,.6,.15,'triangle');
        for(const interval of [0,4,7])this.tone(440*2**((root+12+interval-69)/12),time+.12,.5,.025,'sine');
      }
      this.nextBeat+=.31;this.beat++;
    }
  }
  play(event){if(!this.context)return;const now=this.context.currentTime;if(event==='fill'||event==='pour'){this.noise(1.2,.26,1100);for(let i=0;i<6;i++)this.tone(300+Math.random()*600,now+i*.15,.09,.08);}if(event==='boil')this.noise(.6,.1,400);if(event==='bubble'){this.tone(160+Math.random()*450,now,.09,.045);this.noise(.06,.04,800);}if(event==='click'){this.noise(.045,.6,2800);this.tone(1700,now,.035,.16,'square');}if(event==='paid'||event==='upgrade'){[0,4,7,event==='upgrade'?12:7].forEach((note,i)=>this.tone(520*2**(note/12),now+i*.08,.25,.15));}if(event==='win'){[0,4,7,12,7,12,16,19].forEach((note,i)=>this.tone(260*2**(note/12),now+i*.18,.7,.2));}}
  pause(){this.context?.suspend();}
  resume(){if(this.context){this.nextBeat=this.context.currentTime;this.context.resume();}}
}
