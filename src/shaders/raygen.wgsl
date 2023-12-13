const SAMPLES = 2; // Isn't this redundant with frame accumulation?

const MATERIAL_COUNT = 100;
const SPHERE_COUNT = 300;

const gamma = 1 / 2.2;

struct Camera {
  // position: vec3<f32>,
  // right: vec3<f32>    // u
  // up: vec3<f32>,      // v
  // forward: vec3<f32>, // w

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

struct SceneProps {
  sunIntensity: f32,
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
@group(0) @binding(6) var<uniform> sceneProps: SceneProps;
@group(0) @binding(7) var<uniform> random_seed: f32;
@group(0) @binding(8) var<uniform> accumulations: f32;
@group(0) @binding(9) var<storage, read_write> accumulationColors: array<vec3<f32>>;

struct Ray {
  origin: vec3<f32>,
  direction: vec3<f32>
}

struct RayPayload {
  // color: vec3<f32>,
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

fn trace_ray(ray: Ray) -> RayPayload {
  var rayPayload: RayPayload;

  var hitSomething = false;
  var hitDistance: f32 = 0x1.fffffep+127f; // max float
  var objectIndex: u32 = 0;

  // for every object (sphere) check if our ray intersects it
  for (var i = 0u; i < u32(sceneProps.spheres); i++) {
    let sphere = spheres[i];
    var origin = ray.origin - sphere.pos;

    let a = dot(ray.direction, ray.direction);
    let b = 2 * dot(origin, ray.direction);
    let c = dot(origin, origin) - sphere.r * sphere.r;

    var descriminant = b * b - 4 * a * c;

    // no solutions: miss
    if descriminant < 0 {
        continue;
    }

    // we only need the near solution: side facing us
    // let t0 = (-b + sqrt(descriminant)) / (2. * a);
    let t1 = (-b - sqrt(descriminant)) / (2. * a);

    if t1 < hitDistance && t1 >= 0 {
      hitSomething = true;
      hitDistance = t1;
      objectIndex = i;
    }
  }
  if hitSomething {
    return chit(ray, hitDistance, objectIndex);
  }
  return miss(ray);
}

fn chit(ray: Ray, hitDistance: f32, objectIndex: u32) -> RayPayload {
  var rayPayload: RayPayload;
	rayPayload.hitDistance = hitDistance;
	rayPayload.objectIndex = objectIndex;

	let closestSphere = spheres[objectIndex];
	let origin: vec3<f32> = ray.origin - closestSphere.pos;
	rayPayload.worldPosition = origin + ray.direction * hitDistance;
	rayPayload.worldNormal = normalize(rayPayload.worldPosition);
	rayPayload.worldPosition += closestSphere.pos;

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
    ray.direction = rayDirection;
    ray.origin = rayOrigin;
    for (var i = 0u; i < u32(sceneProps.rayBounces); i++) {
      // offsets ray start position across samples for anti-alias effect
      // constant factor seems bad, but no other option? 
      ray.origin += (rand(global_id.x * i, random_seed) - 0.5) * sceneProps.rayOffset;

      let rayPayload: RayPayload = trace_ray(ray);
      if (rayPayload.hitDistance == -1.) { // it didn't hit anything
        // light += vec3(0.53, 0.8, 0.92) * contribution; // hit background
        break;
      }

      let sphere = spheres[rayPayload.objectIndex];
      let hitMaterial = materials[u32(sphere.material_index)];

      light += contribution * hitMaterial.emission_color * hitMaterial.emission_intensity;

      if (hitMaterial.emission_intensity > 0.0) {
        break;
      }

      contribution *= hitMaterial.albedo;

      // move ray to hit for next, but a lil away so it doesnt collide with the inside
      ray.origin = rayPayload.worldPosition + rayPayload.worldNormal * 0.0001;

      let reflectedDirection = reflect(ray.direction, rayPayload.worldNormal);

      let randomVector = normalize(vec3(rand(global_id.x + i, random_seed) - 0.5, 
                                        rand(global_id.x * 2 + i, random_seed) - 0.5, 
                                        rand(global_id.x * 3 + i, random_seed) - 0.5));

      ray.direction = normalize(mix(reflectedDirection, randomVector, hitMaterial.roughness));
      ray.direction = normalize(ray.direction + rayPayload.worldNormal);
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
