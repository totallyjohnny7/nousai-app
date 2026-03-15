import React from 'react';
import { Composition } from 'remotion';
import { NousAIDemo } from './NousAIDemo';

export const NousAIRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="NousAIDemo"
        component={NousAIDemo}
        durationInFrames={900}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
