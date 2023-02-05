const MATERIAL_COUNT = 5;
const SPHERE_COUNT = 5;
const BOUNCES = 6;

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
    r: f32,
    m: f32,
}

struct Sphere {
    pos: vec3<f32>,
    r: f32,
    material_index: f32,
}

@group(0) @binding(0) var<storage, read_write> pixelColors: array<vec3<f32>>;
@group(0) @binding(1) var<uniform> screenResolution: vec2<f32>;
@group(0) @binding(2) var<uniform> rayOrigin: vec3<f32>;
@group(0) @binding(3) var<uniform> camera: Camera;
@group(0) @binding(4) var<uniform> materials: array<Material, MATERIAL_COUNT>;
@group(0) @binding(5) var<uniform> spheres: array<Sphere, SPHERE_COUNT>;
@group(0) @binding(6) var<uniform> lightDir: vec3<f32>;
@group(0) @binding(7) var<uniform> random_seed: f32;
@group(0) @binding(8) var<uniform> accumulations: f32;
@group(0) @binding(9) var<storage, read_write> accumulationColors: array<vec3<f32>>;

struct Ray {
    origin: vec3<f32>,
    direction: vec3<f32>
}

struct RayPayload {
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
    var hitDistance: f32 = 0x1.fffffep+127f;
    var objectIndex: u32 = 0;

    for (var i = 0u; i < SPHERE_COUNT; i++) {
        let sphere = spheres[i];
        var origin = ray.origin - sphere.pos;

        let a = dot(ray.direction, ray.direction);
        let b = 2 * dot(origin, ray.direction);
        let c = dot(origin, origin) - sphere.r * sphere.r;

        var descriminant = b * b - 4 * a * c;

        if descriminant < 0 {
            continue;
        }

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

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    if global_id.x > u32(screenResolution.x * screenResolution.y) {
        pixelColors[global_id.x] = vec3(0, 0, 1);
        return;
    }

    let coords = vec2<f32>(f32(global_id.x % u32(screenResolution.x)), f32(global_id.x / u32(screenResolution.x)));
    let rayDirection = calculate_ray_direction(coords);

    var ray: Ray;
    ray.origin = rayOrigin;
    ray.direction = rayDirection;

    var color = vec3<f32>(0., 0., 0.);
    var multiplier = 1.0;

    for (var i = 0u; i < BOUNCES; i++) {
        let rayPayload: RayPayload = trace_ray(ray);
        if (rayPayload.hitDistance < 0.) {
            // color += vec3(0.5, 0.75, 0.95) * multiplier; // draw background
            color += vec3(0.,0.,0.) * multiplier; // draw background
            // break;
        }

        let light_dir = normalize(lightDir);
        let light_intensity: f32 = max(dot(rayPayload.worldNormal, -light_dir), 0.0f); // cos(angle)

        let sphere = spheres[rayPayload.objectIndex];
        var sphere_color = materials[u32(sphere.material_index)].albedo;
        sphere_color *= light_intensity;
        color += sphere_color * multiplier;

        multiplier *= 0.5;

        ray.origin = rayPayload.worldPosition + rayPayload.worldNormal * 0.0001;

        let random = fract(sin(dot(
                vec2(f32(global_id.x)/exp2(14), random_seed),
                vec2(12.9898, 78.233)
            )) * 43758.5453) - 0.5;

        let random2 = fract(sin(dot(
                vec2(f32(global_id.x)/exp2(14), random_seed),
                vec2(12.9898, 78.233)
            )) * 43758.5453) - 0.5;

        let random3 = fract(sin(dot(
                vec2(f32(global_id.x)/exp2(14), random_seed),
                vec2(12.9898, 78.233)
            )) * 43758.5453) - 0.5;

        let random_offset_normal = rayPayload.worldNormal +
        materials[u32(sphere.material_index)].r * vec3(random,random2,random3);
        // reflect
        ray.direction = ray.direction - 2.0 *
            dot(random_offset_normal, ray.direction) *
            random_offset_normal;
    }

    if (accumulations > 1) {
        accumulationColors[global_id.x] += color;
        pixelColors[global_id.x] = accumulationColors[global_id.x] / accumulations;
    } else {
        accumulationColors[global_id.x] = color;
        pixelColors[global_id.x] = color;
    }

    return;
}
