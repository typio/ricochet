import Renderer from "./renderer";

const canvas = document.createElement("canvas");
const appElement = document.getElementById("app");
appElement?.appendChild(canvas);
canvas.width = window.innerWidth;
canvas.height = window.innerWidth;

const renderer = new Renderer(canvas);
renderer.start();
