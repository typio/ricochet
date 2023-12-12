import Renderer from "./renderer";
import Camera from "./camera";
import Scene from "./scene";

const canvas = document.createElement("canvas");
canvas.oncontextmenu = () => false;
const appElement = document.getElementById("app");
appElement?.prepend(canvas);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const scene = new Scene();
const camera = new Camera(canvas, 45, 0.1, 100, 0.45);
const renderer = new Renderer(canvas, scene, camera); // Objects are passed by reference 🙌
renderer.start();
