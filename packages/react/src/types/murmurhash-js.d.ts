declare module 'murmurhash-js' {
  const murmur: {
    murmur2(str: string, seed?: number): number;
    murmur3(str: string, seed?: number): number;
  };
  export default murmur;
}
