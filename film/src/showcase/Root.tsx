import { Composition } from "remotion";
import { DURATION, Showcase } from "./Showcase";

export const Root: React.FC = () => (
  <Composition id="Showcase" component={Showcase} durationInFrames={DURATION} fps={30} width={1920} height={1080} defaultProps={{ bgm: true }} />
);
