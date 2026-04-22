// Provide minimal JSX intrinsics for @react-three/fiber primitives used in components
// This silences TSX complaints about <group>, <mesh>, <primitive>, etc.

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      boxGeometry: any;
      meshStandardMaterial: any;
      primitive: any;
      line: any;
      svg: any;
    }
  }
}

export {};
