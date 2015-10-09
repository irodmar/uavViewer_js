



var introrobot_js = function(ip, baseextraPort, navdataProxyPort, cmdVelProxyPort, pose3DProxyPort){
        // start = conectar ice +  sus funciones
        // canvas = pintar el canvas
        // Control de instrumentos 

        
        // Variables generales
        var ARDRONE1 = 0;
        var ARDRONE2 = 1;
        var ARDRONE_SIMULATED = 10;
        var virtualDrone = true;
        
        
        // Variable ICE para la conexion
        var id = new Ice.InitializationData();
        id.properties = Ice.createProperties();
        //id.properties.setProperty("Ice.Trace.Network", "3"); // Propiedad para tracear la conexion
        //sid.properties.setProperty("Ice.Trace.Protocol", "1"); // Propiedad para tracear la conexion
        var communicator = Ice.initialize(id);
        
        // Variables de control del Drone
        var navdataProxy;
        var extraProxy;
        var cmdVelProxy;
        var pose3DProxy;

        //********************************************************************************************
        //********************************************************************************************
        // Variable datos del drone
        var navdata = new jderobot.NavdataData; //nvdata
        var cmd = new jderobot.CMDVelData; //cmdVelData
        cmd.linearX=0.0;
        cmd.linearY=0.0;
        cmd.linearZ=0.0;
        cmd.angularZ=0.0;
        cmd.angularX=0.5;
        cmd.angularY=1.0;
        window.cmd = cmd;
        
        var pose = new jderobot.Pose3DData; //pose3DData
        
        //*********************************************************************************************
        //*********************************************************************************************
        // Variables del canvas del manejo del vuelo
        var canvas;
        // Dimensions of the canvas
        var canvasX;
        var canvasY;
        // var defines send data or not
        var mouseIsDown = false;
        var moveCircle = false;
        // radious of the circle
        var radious = 7;
        //pos the center of the circle
        var circleX;
        var circleY;
        
        
        // Varibale del panel de control de los intrumentos
        var PanelControl;
        var intervalo = null;


        
        // ICE Connect
        function startConnection(){
                return new Promise(function(resolve, reject) {
                        // base extra connection
                        var baseextra = communicator.stringToProxy("Extra:ws -h 10.10.48.104 -p 17000");
                        jderobot.ArDroneExtraPrx.checkedCast(baseextra).then(
                            function(ar){
                                extraProxy = ar;
                                console.log("extraProxy connected: " + ar);
                            },
                            function(ex, ar){
                                console.log("extraProxy NOT connected: " + ex);
                            }
                        );               
                        
                        
                        // NavData
                        var basenavdata = communicator.stringToProxy("Navdata:ws -h 10.10.48.104 -p 15000");
                        jderobot.NavdataPrx.checkedCast(basenavdata).then(
                            function(ar){
                                console.log("navdataProxy connected: " + ar);
                                navdataProxy = ar;
                                navdataProxy.getNavdata().then(
                                function(navdata){
                                    if (navdata.vehicle == ARDRONE_SIMULATED) {
                                        virtualDrone = true;
                                        console.log("virtualDrone = true");
                                    } else {
                                        virtualDrone = false;
                                        console.log("virtualDrone = false");
                                    }
                                },
                                function (ex, ar){
                                    console.log("Fail getNavdata() function: " + ex);
                                }
                                );
                            },
                            function (ex, ar){
                                console.log("navdataProxy NOT connected: " + ex);
                            }        
                        );        
                      
                        // CMDVelPrx
                        var basecmdVel = communicator.stringToProxy("CMDVel:ws -h 10.10.48.104 -p 11000");
                        jderobot.CMDVelPrx.checkedCast(basecmdVel).then(
                            function(ar){
                                console.log("cmdVelProxy connected: " + ar);
                                cmdVelProxy = ar;
                            },
                            function(ex, ar){
                                console.log("cmdVelProxy NOT connected: " + ex);
                            }
                        );             
                      
                        // Pose3D
                       var basepose3D = communicator.stringToProxy("ImuPlugin:ws -h 10.10.48.104 -p 19000");
                       jderobot.Pose3DPrx.checkedCast(basepose3D).then(
                           function(ar){
                               console.log("pose3DProxy connected: " + ar);
                               pose3DProxy = ar;
                                window.po = pose3DProxy;
                                resolve("Stuff worked!");
                               pose3DProxy.getPose3DData().then(
                                   function (ar){
                                       console.log("getPoseDData().");
                                       pose = ar;
                                   },
                                   function(ex, ar){
                                       console.log("Fail call getPoseDData().");
                                   });
                           },
                           function(ex, ar){
                               console.log("pose3DProxy NOT connected: " + ex)
                           }
                       );
                    });
                }
        
        
        // Canvas        
        function startCanvas(){
                
            canvas = document.getElementById("canvas");
            
            if (canvas.getContext) {
              var context = canvas.getContext('2d');
              // Size of the cnvas to draw circle in the middle the axis position
              canvasX = context.canvas.width;
              canvasY = context.canvas.height;
              circleX = canvasX/2;
              circleY = canvasY/2;
              // Draw a circle in the center of the canvas
              context.beginPath();
              context.fillStyle = "rgb(255, 0, 0)";
              context.arc(circleX, circleY, radious, 0, 2 * Math.PI, true);
              context.fill();
            }
            
            // Add event listener for `click` events.
            canvas.onmousedown = function(e) {
                mouseIsDown = true;
                var x = e.pageX - this.offsetLeft;
                var y = e.pageY - this.offsetTop;
                if ((circleX - (radious/2)) < x && x < (circleX + (radious/2)) && (circleY - (radious/2)) < y && y < (circleY + (radious/2))) {
                    moveCircle = true;
                }
            }
            // When release the click stop sending data
            canvas.onmouseup = function(e){
                mouseIsDown = false;
                moveCircle = false;
            }
        
            // Get the mouse position
            canvas.onmousemove = function (e) {
                if (mouseIsDown && moveCircle){
                    var x = e.pageX - this.offsetLeft - (canvasX/2);
                    var y = (e.pageY - this.offsetTop - (canvasY/2))*(-1);
                    setVY(x/(canvasX/2)); // Change variables and send the command to the drone
                    setVX(y/(canvasY/2));
                    sendVelocities();
                    circleX = e.pageX - this.offsetLeft; // eliminamos el circulo y dibujamos otro con las nuevas coordenadas
                    circleY = e.pageY - this.offsetTop;
                    context.clearRect(0, 0, canvas.width, canvas.height);
                    context.beginPath();
                    context.fillStyle = "rgb(255, 0, 0)";
                    context.arc(circleX, circleY, radious, 0, 2 * Math.PI, true);
                    context.fill();
               }
            };
            }
                       
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        // Functions return the value of fliying parameters
        function getYaw(qw,qx,qy,qz) {                     
                var rotateZa0=2.0*(qx*qy + qw*qz);
                var rotateZa1=qw*qw + qx*qx - qy*qy - qz*qz;
                var rotateZ=0.0;
                if(rotateZa0 != 0.0 && rotateZa1 != 0.0){
                    rotateZ=Math.atan2(rotateZa0,rotateZa1);
                }
                return rotateZ*180/Math.PI ;
        }
        
        function getRoll(qw,qx,qy,qz){
                rotateXa0=2.0*(qy*qz + qw*qx);
                rotateXa1=qw*qw - qx*qx - qy*qy + qz*qz;
                rotateX=0.0;
                
                if(rotateXa0 != 0.0 && rotateXa1 !=0.0){
                    rotateX=Math.atan2(rotateXa0, rotateXa1)
                }   
                return rotateX*180/Math.PI;
        }
        function getPitch(qw,qx,qy,qz){
                rotateYa0=-2.0*(qx*qz - qw*qy);
                rotateY=0.0;
                if(rotateYa0>=1.0){
                    rotateY=math.PI/2.0;
                } else if(rotateYa0<=-1.0){
                    rotateY=-Math.PI/2.0
                } else {
                    rotateY=Math.asin(rotateYa0)
                }
                
                return rotateY*180/Math.PI;
        }
        //*********************************************************************************************
        //*********************************************************************************************
        

        
       
        
        // extraProxy functions  
        this.takeoff = function () {
            extraProxy.takeoff().then(
                function(ar){
                    console.log("Take Off.");
                },
                function(ex, ar){
                    console.log("Take Off failed.")
                }
                );
        }
            
        this.land = function() {
                extraProxy.land().then(
                function(ar){
                    console.log("Landing.");
                },
                function(ex, ar){
                    console.log("Landing failed: " + ex)
                }
                );
        }
        
        this.toogleCam = function(){
                extraProxy.toggleCam().then(
                function(ar){
                    console.log("toggleCam.");
                },
                function(ex, ar){
                    console.log("toggleCam failed: " + ex)
                }
            );
        }
        
        this.reset = function() {
            extraProxy.reset().then(
                function(ar){
                    console.log("Reset.");
                },
                function(ex, ar){
                    console.log("Reset failed: " + ex)
                }
            );
        }
        
        
        

        
        
        function updateNavData() {
            navdataProxy.getNavdata().then(
                function(ar){
                    navdata = ar;
                    //console.log("updateNavData()");
                },
                function (ex, ar){
                    console.log("Fail getNavdata() function." + ex)
                }        
            );    
        }
        
        
        

        
        this.velocities = function() {
            window.cmdV=cmdVelProxy;
            cmdVelProxy.setCMDVelData(cmd).then(
            function(ar){
                console.log("Velocities.");
            },
            function(ex, ar){
                console.log("Velocities failed.")
            }
        );
        }
        
        function sendVelocities () {
            window.cmdV=cmdVelProxy;
            cmdVelProxy.setCMDVelData(cmd).then(
            function(ar){
                //console.log("sendVelocities.");
            },
            function(ex, ar){
                console.log("sendVelocities failed.")
            }
        );
        }
        
        this.sendCMDVel = function(vx,vy,vz,yaw,roll,pitch){
            cmd.linearX=vy
            cmd.linearY=vx
            cmd.linearZ=vz
            cmd.angularZ=yaw
            cmd.angularX=cmd.angularY=1.0
            sendVelocities();
        }
        
        

        
            
        function updatePose(){
            pose3DProxy.getPose3DData().then(
                    function (ar){
                        pose=ar;
                        //console.log("getPose3DData. ")
                    },
                    function(ex, ar){
                        console.log("Fail call getPoseDData(): " + ar2);
                    });   
        }
        
        function setPose3D (){    
            pose3DProxy.setPose3DData(pose).then(
                    function (ar){
                        console.log("setPose3DData.");
                    },
                    function(ex, ar){
                        console.log("Fail setPose3DData function: " + ar);
                    });   
        }
        
        

        function setVX(vx){
                cmd.linearX=vx;
        }
        function setVY(vy){
                cmd.linearY=vy;
        } 
        function setVZ(vz){
                cmd.linearZ=vz;
        }
        function setYaw(yaw){
                cmd.angularZ=yaw;        
        }
        function setRoll(roll){
                cmd.angularX=roll; 
        }
        function setPitch(pitch){
                cmd.angularY=pitch;
        }
        
        
        this.Fader = function (value) {
            var val =  document.getElementById('altura').value;    
            document.querySelector('#val').value = val;
            setVZ(val);
            sendVelocities();
         }
         
        this.start = function(){
                startConnection().then(
                        function(ar){
                                console.log(ar);
                                startCanvas();
                                PanelControl = new panelControl();
                                intervalo = setInterval(updateAndShow, 20);
                        },
                        function(ex, ar){
                                console.log(ex+ar);
                        }
                );
                   
        }
        

        
              
        
        
        function updateAndShow(){
                updatePose();
                updateNavData();
                // calculate yaw, pitch, and roll
                var yaw = getYaw(pose.q0, pose.q1, pose.q2, pose.q3);
                var pitch = getPitch(pose.q0, pose.q1, pose.q2, pose.q3);
                var roll = getRoll(pose.q0, pose.q1, pose.q2, pose.q3);                
                PanelControl.updatePanelControl(yaw, pitch, roll, pose);
        }
}    