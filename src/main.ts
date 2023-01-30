import Renderer from "./renderer";
import Camera from "./camera";

const canvas = document.createElement("canvas");
canvas.oncontextmenu = () => false;
const appElement = document.getElementById("app");
appElement?.appendChild(canvas);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const camera = new Camera(canvas, 45, 0.1, 100, 0.1);
const renderer = new Renderer(canvas, camera); // Objects are passed by reference 🙌
renderer.start();
