import resolve from "@rollup/plugin-node-resolve";

export default {
  input: "pf2e-subsystems.js",
  output: {
    file: "Subsystems.js",
    format: "es",
    sourcemap: true,
  },
  plugins: [resolve()],
};
