import coreDark from "./coreDark";
import coreLight from "./coreLight";
import nebula from "./nebula";
import viscera from "./viscera";
import water from "./water";

const subsystemsThemes = {
  coreLight: coreLight,
  coreDark: coreDark,
  nebula: nebula,
  viscera: viscera,
  water: water,
};

export const subsystemsThemeChoices = {
  coreLight: "Core Light",
  coreDark: "Core Dark",
  nebula: "Nebula",
  viscera: "Viscera",
  water: "Water",
};

export default subsystemsThemes;
