@group(0) @binding(0) var<uniform> screenResolution: vec2<f32>;
@group(0) @binding(1) var<storage, read> pixelColors: array<vec3<u32>>;

struct VertexOutput {
    @builtin(position) pos: vec4<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index : u32) -> VertexOutput {
    var pos = array<vec2<f32>, 6>
        (
            vec2<f32>( 1.0,  1.0),
            vec2<f32>( 1.0, -1.0),
            vec2<f32>(-1.0, -1.0),
            vec2<f32>( 1.0,  1.0),
            vec2<f32>(-1.0, -1.0),
            vec2<f32>(-1.0,  1.0)
        );

    var out : VertexOutput;
    out.pos = vec4<f32>(pos[vertex_index], 0.0, 1.0);
    return out;
}

@fragment
fn  fs_main(@builtin(position) coords: vec4<f32>) -> @location(0) vec4<f32> {
    let index = u32(coords.y * screenResolution.x + coords.x);

    let r = f32(pixelColors[index].x);
    let g = f32(pixelColors[index].y);
    let b = f32(pixelColors[index].z);

    return vec4<f32>(r, g, b, 1.0);
}
