define([
    'threejs',
    'threeTrackball'
], function() {
    'use strict';

    var THREE = window.THREE || {},
        container, camera, scene, renderer, controls;

    function init() {
        container = document.getElementById('model-displayer');

        camera = new THREE.PerspectiveCamera( 70, container.offsetWidth / container.offsetHeight, 1, 3000 );
        camera.position.set(10, 10, 10);

        scene = new THREE.Scene();
        scene.fog = new THREE.Fog(0x050505, 2000, 3500);

        // add controls
        addControls();

        // add light
        addLights();

        // add axises
        addAxises();

        renderer = new THREE.WebGLRenderer({
            antialias: false
        });
        renderer.setClearColor(scene.fog.color);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(renderer.domElement);

        window.addEventListener('resize', onWindowResize, false);

        animate();
    }

    function appendModel(model_data) {
        var SET_ELEM_NUMBER = 6,
            X = 0,
            Y = 1,
            Z = 2,
            RED = 3,
            GREEN = 4,
            BLUE = 5,
            number_sets = model_data.length / SET_ELEM_NUMBER,
            vertices = new Float32Array( number_sets * 3 ), // three components per vertex
            colors = new Float32Array( number_sets * 3 ),
            color = new THREE.Color(),
            geometry, material, mesh;

        geometry = new THREE.BufferGeometry();

        // components of the position vector for each vertex are stored
        // contiguously in the buffer.
        for ( var i = 0; i < model_data.length; i += SET_ELEM_NUMBER ) {
            vertices[ i + 0 ] = model_data[ i + X ];
            vertices[ i + 1 ] = model_data[ i + Y ];
            vertices[ i + 2 ] = model_data[ i + Z ];

            color.setRGB(
                model_data[ i + RED ],
                model_data[ i + GREEN ],
                model_data[ i + BLUE ]
            );

            colors[ i + 0 ] = color.r;
            colors[ i + 1 ] = color.g;
            colors[ i + 2 ] = color.b;
        }

        geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
        geometry.addAttribute( 'color', new THREE.BufferAttribute(colors, 3));

        geometry.computeBoundingBox();

        material = new THREE.PointCloudMaterial({
            size: 0.01,
            vertexColors: THREE.VertexColors
        });

        mesh = new THREE.PointCloud( geometry, material );
        scene.add( mesh );

        return mesh;
    }

    function addControls() {
        controls = new THREE.TrackballControls( camera );

        controls.rotateSpeed = 2.0;
        controls.zoomSpeed = 1.2;
        controls.panSpeed = 1.8;

        controls.noZoom = false;
        controls.noPan = false;

        controls.staticMoving = true;
        controls.dynamicDampingFactor = 0.3;

        controls.addEventListener( 'change', render );
    }

    function addLights() {
        scene.add(new THREE.AmbientLight(0xffffff));

        var light1 = new THREE.DirectionalLight(0xffffff, 0.5);
        light1.position.set(1, 1, 1);
        scene.add(light1);

        var light2 = new THREE.DirectionalLight(0xffffff, 1.5);
        light2.position.set(0, -1, 0);
        scene.add(light2);
    }

    function addAxises() {
        var materials = [
                new THREE.LineBasicMaterial({ color: 0x0000ff }),   // x
                new THREE.LineBasicMaterial({ color: 0x00ff00 }),   // y
                new THREE.LineBasicMaterial({ color: 0xffffff })    // z
            ],
            vertices = [
                [   // x
                    new THREE.Vector3( -100, 0, 0 ),
                    new THREE.Vector3( 100, 0, 0 )
                ],
                [   // y
                    new THREE.Vector3( 0, -100, 0 ),
                    new THREE.Vector3( 0, 100, 0 )
                ],
                [   // z
                    new THREE.Vector3( 0, 0, -100 ),
                    new THREE.Vector3( 0, 0, 100 )
                ],
            ],
            geometry;

        materials.forEach(function(material, index) {
            geometry = new THREE.Geometry();
            geometry.vertices = vertices[index];

            scene.add( new THREE.Line( geometry, material ) );
        });
    }

    function onWindowResize() {

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        renderer.setSize(window.innerWidth, window.innerHeight);

    }

    function animate() {
        requestAnimationFrame(animate);
        controls.update();

        render();
    }

    function render() {
        renderer.render(scene, camera);
    }

    return {
        init: init,
        appendModel: appendModel
    };
});