const SAMPLES = 2; // Isn't this redundant with frame accumulation?

const MATERIAL_COUNT = 100;
const SPHERE_COUNT = 300;
const VERTEX_COUNT = 100;
const TRIANGLE_COUNT = 100;

const gamma = 1 / 2.2;

struct Camera {
  inverse_projection: mat4x4<f32>,
  inverse_view: mat4x4<f32>,
}

struct Material {
  albedo: vec3<f32>, 
  spacer: f32,                  // NOTE: Alignment of vec3<f32> is 16bytes so the 4 bytes following it aren't accessible
  roughness: f32,            
  metallic: f32,                // everything is "metaliic" rn ig
  spacer2: vec2<f32>,            
  emission_color: vec3<f32>,
  emission_intensity: f32,
}

struct Sphere {
  pos: vec3<f32>,
  r: f32,
  material_index: f32,
}

struct Vertex {
  pos: vec3<f32>, 
  space: f32,
}

struct Triangle {
  v0: u32,
  v1: u32,
  @size(8) v2: u32
}

struct SceneProps {
  sunIntensity: f32,
  lightsIntensity: f32,
  spheres: f32,
  rayOffset: f32,
  rayBounces: f32,
}

@group(0) @binding(0) var<storage, read_write> pixelColors: array<vec3<f32>>;
@group(0) @binding(1) var<uniform> screenResolution: vec2<f32>;
@group(0) @binding(2) var<uniform> rayOrigin: vec3<f32>;
@group(0) @binding(3) var<uniform> camera: Camera;
@group(0) @binding(4) var<uniform> materials: array<Material, MATERIAL_COUNT>;
@group(0) @binding(5) var<uniform> spheres: array<Sphere, SPHERE_COUNT>;
@group(0) @binding(6) var<uniform> vertices: array<Vertex, VERTEX_COUNT>;
@group(0) @binding(7) var<uniform> triangles: array<Triangle, TRIANGLE_COUNT>;
@group(0) @binding(8) var<uniform> sceneProps: SceneProps;
@group(0) @binding(9) var<uniform> random_seed: f32;
@group(0) @binding(10) var<uniform> accumulations: f32;

struct Ray {
  o: vec3<f32>,
  d: vec3<f32>
}

struct RayPayload {
  hitType: u32,
  objectIndex: u32,

  hitDistance: f32,

  worldPosition: vec3<f32>,
  worldNormal: vec3<f32>
}

// try using <workgroup>? https://www.w3.org/TR/WGSL/#compute-shader-workgroups
fn calculate_ray_direction(coordinate: vec2<f32>) -> vec3<f32> {
  let current_pixel = coordinate;
  let pixel_center = (current_pixel + vec2(.5, .5)) / screenResolution;

  // stands for normalized device coordinate
  let ndc: vec2<f32> = vec2(2., -2.) * pixel_center + vec2(-1., 1.);
  let ray_target: vec4<f32> = camera.inverse_projection * vec4<f32>(ndc.x, ndc.y, 1., 1.);
  let pixel_ray_direction: vec4<f32> = camera.inverse_view * vec4<f32>(
    normalize(vec3<f32>(ray_target.xyz) / ray_target.w),
    0.
  );

  return pixel_ray_direction.xyz;
}

fn permute(vec: vec3<f32>, indices: vec3<u32>) -> vec3<f32> {
  var new_vec = vec3<f32>(0.0, 0.0, 0.0);
  new_vec.x = vec[indices.x];
  new_vec.y = vec[indices.y];
  new_vec.z = vec[indices.z];
  return new_vec;
}

fn length_squared(v: vec3<f32>) -> f32 {
  return dot(v, v);
}

fn difference_of_products(a: f32, b: f32, c: f32, d: f32) -> f32 {
  let cd = c * d;
  let diff = a * b - c * d;
  let error = -c * d + c * d;
  return diff + error;
}

fn trace_ray(ray: Ray) -> RayPayload {
  var rayPayload: RayPayload;

  var hitType: u32 = 0;
  var hitDistance: f32 = 0x1.fffffep+127f; // max float
  var objectIndex: u32 = 0;

  // for every object (sphere) check if our ray intersects it
  let a = dot(ray.d, ray.d);
  for (var i = 0u; i < u32(sceneProps.spheres); i++) {
    let sphere = spheres[i];
    var origin = ray.o - sphere.pos;

    let b = 2 * dot(origin, ray.d);
    let c = dot(origin, origin) - sphere.r * sphere.r;

    var descriminant = b * b - 4 * a * c;

    if descriminant < 0 { continue; }
    // we only need the near solution: side facing us
    let t1 = (-b - sqrt(descriminant)) / (2. * a);

    if t1 < hitDistance && t1 >= 0 {
      hitType = 1;
      hitDistance = t1;
      objectIndex = i;
    }
  }

  // This part of triangle check depends only on ray so we take it out of loop
  var ray_d = ray.d;
  let d = abs(ray.d);
  var kz = 0u;
  if (d.y > d.x && d.y > d.z) { kz = 1u; }
  if (d.z > d.x && d.z > d.y) { kz = 2u; }
  var kx = kz + 1; 
  if (kx == 3) { kx = 0; }
  var ky = kx + 1; 
  if (ky == 3) { ky = 0; }
  ray_d = permute(ray.d, vec3<u32>(kx, ky, kz));

  // for every triangle check if our ray intersects it
  for (var i = 0u; i < TRIANGLE_COUNT; i++) {
    let triangle = triangles[i];
    let v0 = vertices[triangle.v0].pos;
    let v1 = vertices[triangle.v1].pos; //2
    let v2 = vertices[triangle.v2].pos; //0 
    // Intersection test idea is to transform the ray (Translate, Permute, Shear) to be perpendicular to the triangle plane
    // and then we can solve an easy 2d problem

    // collinear/ degenerate triangle check
    if (length_squared(cross(v1 - v0, v2 - v0)) == 0) {
      continue;
    }

    // Transform triangle vertices to ray coordinate space
    var v0t = v0 - vec3<f32>(ray.o);
    var v1t = v1 - vec3<f32>(ray.o);
    var v2t = v2 - vec3<f32>(ray.o);

    // Permute space so for example if ray z is 0, another dimension is a assigned to it
    v0t = permute(v0t, vec3<u32>(kx, ky, kz));
    v1t = permute(v1t, vec3<u32>(kx, ky, kz));
    v2t = permute(v2t, vec3<u32>(kx, ky, kz));

    // Shear coordinate space
    let Sx = -ray_d.x / ray_d.z;
    let Sy = -ray_d.y / ray_d.z;
    let Sz = 1 / ray_d.z;
    v0t.x += Sx * v0t.z; v1t.x += Sx * v1t.z; v2t.x += Sx * v2t.z; 
    v0t.y += Sy * v0t.z; v1t.y += Sy * v1t.z; v2t.y += Sy * v2t.z;

    let e0 = difference_of_products(v1t.x, v2t.y, v1t.y, v2t.x);
    let e1 = difference_of_products(v2t.x, v0t.y, v2t.y, v0t.x);
    let e2 = difference_of_products(v0t.x, v1t.y, v0t.y, v1t.x);

    if ((e0 < 0 || e1 < 0 || e2 < 0) && (e0 > 0 || e1 > 0 || e2 > 0)) { continue; }

    let det = e0 + e1 + e2;
    if (det == 0) { continue; }

    // Ray intersects so shear z now
    v0t.z *= Sz; v1t.z *= Sz; v2t.z *= Sz;

    let tScaled = e0 * v0t.z + e1 * v1t.z + e2 * v2t.z;
    if (det < 0 && (tScaled >= 0)) { // || tScaled < tMax * det)) {
      continue;
    } else if (det > 0 && (tScaled <= 0)) { // || tScaled > tMax * det)) {
      continue;
    }

    let invDet = 1 / det;
    let b0 = e0 * invDet; 
    let b1 = e1 * invDet; 
    let b2 = e2 * invDet;
    let t = tScaled * invDet;

    if (t < hitDistance) {
      hitType = 2;
      hitDistance = t;
      objectIndex = 0;
    }
  }

  if hitType != 0u {
    return chit(ray, hitDistance, hitType, objectIndex);
  }

  return miss(ray);
}

fn chit(ray: Ray, hitDistance: f32, hitType: u32, objectIndex: u32) -> RayPayload {
  var rayPayload: RayPayload;
	rayPayload.hitDistance = hitDistance;
	rayPayload.hitType = hitType;
	rayPayload.objectIndex = objectIndex;

  if (hitType == 1) {
    let closestSphere = spheres[objectIndex];
    let origin: vec3<f32> = ray.o - closestSphere.pos;
    rayPayload.worldPosition = origin + ray.d * hitDistance;
    rayPayload.worldNormal = normalize(rayPayload.worldPosition);
    rayPayload.worldPosition += closestSphere.pos;
  } else if (hitType == 2) { // Triangle
    let triangle = triangles[objectIndex];
    let v0 = vertices[triangle.v0].pos;
    let v1 = vertices[triangle.v1].pos;
    let v2 = vertices[triangle.v2].pos;

    let closestTriangle = triangles[objectIndex];
    let origin: vec3<f32> = ray.o - v0;
    rayPayload.worldPosition = origin + ray.d * hitDistance;
    rayPayload.worldNormal = (cross(v1 - v0, v2 - v0)); 
    //normalize(rayPayload.worldPosition);
    rayPayload.worldPosition += v0;
  }

  return rayPayload;
}

fn miss(ray: Ray) -> RayPayload {
  var rayPayload: RayPayload;
  rayPayload.hitDistance = -1.;
  return rayPayload;
}

// classic noise hash function
fn rand(x: u32, seed: f32) -> f32 {
  return fract(sin(dot(
    vec2(f32(x) / exp2(14), seed),
    vec2(12.9898, 78.233)
  )) * 43758.5453);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if global_id.x > u32(screenResolution.x * screenResolution.y) {
    pixelColors[global_id.x] = vec3(0, 0, 1);
    return;
  }

  let coords = vec2<f32>(f32(global_id.x % u32(screenResolution.x)), f32(global_id.x / u32(screenResolution.x)));
  let rayDirection = calculate_ray_direction(coords);

  var light = vec3<f32>(0., 0., 0.);

  for (var sample = 0u; sample < SAMPLES; sample++) {
  var contribution = vec3<f32>(1., 1., 1.); // Reset contribution for each sample
    var ray: Ray;
    ray.d = rayDirection;
    ray.o = rayOrigin;
    for (var i = 0u; i < u32(sceneProps.rayBounces); i++) {
      // offsets ray start position across samples for anti-alias effect
      // constant factor seems bad, but no other option? 
      ray.o += (rand(global_id.x * i, random_seed) - 0.5) * sceneProps.rayOffset;

      let rayPayload: RayPayload = trace_ray(ray);
      if (rayPayload.hitType == 0) { // it didn't hit anything
        // light += vec3(0.53, 0.8, 0.92) * contribution; // hit background
        break;
      }

      let reflectedDirection = reflect(ray.d, rayPayload.worldNormal);
      let randomVector = normalize(vec3(rand(global_id.x + i, random_seed) - 0.5, 
                                        rand(global_id.x * 2 + i, random_seed) - 0.5, 
                                        rand(global_id.x * 3 + i, random_seed) - 0.5));

      if (rayPayload.hitType == 1) {
        let sphere = spheres[rayPayload.objectIndex];
        let hitMaterial = materials[u32(sphere.material_index)];

        light += contribution * hitMaterial.emission_color * hitMaterial.emission_intensity;

        if (hitMaterial.emission_intensity > 0.0) {
          break;
        }

        contribution *= hitMaterial.albedo;

        // move ray to hit for next, but a lil away so it doesnt collide with the inside
        ray.o = rayPayload.worldPosition + rayPayload.worldNormal * 0.0001;

        ray.d = normalize(mix(reflectedDirection, randomVector, hitMaterial.roughness));
        ray.d = normalize(ray.d + rayPayload.worldNormal);
      } else if (rayPayload.hitType == 2) {
        light += vec3(0.1, 0.1, 0.1) * contribution; // hit triangle

        ray.o = rayPayload.worldPosition + rayPayload.worldNormal * 0.0001;

        ray.d = normalize(mix(reflectedDirection, randomVector, 0));
        ray.d = normalize(ray.d + rayPayload.worldNormal);
      }
    }
  }

  var finalColor = light / SAMPLES;
  finalColor = pow(finalColor, vec3(gamma, gamma, gamma)); // gamma correction

  if (accumulations > 1) {
    let blendFactor = 1.0 / accumulations;
    pixelColors[global_id.x] = mix(pixelColors[global_id.x], finalColor, blendFactor);
  } else {
    pixelColors[global_id.x] = finalColor;
  }

  return;
}
