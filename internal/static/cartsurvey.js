function cartsurvey_init(d_u,s_u,sui_u) {

    // window.cartogram.scaling_factor = 1.7;

    window.cartsurvey = {

        data_base_url: d_u,
        surveys_base_url: s_u,
        surveys_ui_base_url: sui_u,
        program: null,
        enter_loading_state: function() {

            window.cartogram.enterLoadingState();

        },
        exit_loading_state: function() {

            window.cartogram.exitLoadingState();

        },
        http_get: function(url, timeout=15000) {

            return new Promise(function(resolve, reject){

                var xhttp = new XMLHttpRequest();

                xhttp.onreadystatechange = function() {
                    if(this.readyState == 4)
                    {
                        if(this.status == 200)
                        {
                            try
                            {
                                resolve(JSON.parse(this.responseText));
                            }
                            catch(e)
                            {
                                console.log(e);
                                console.log(this.responseText);
                                reject('Unable to parse output.');
                            }
                        }
                        else
                        {
                            console.log(url);
                            reject('Unable to fetch data from the server.');
                        }
                    }
                };

                xhttp.ontimeout = function(e) {
                    reject('The request has timed out.');
                }

                xhttp.open("GET", url, true);
                xhttp.timeout = timeout;
                xhttp.send();

            });
        },

        changeLayout: function(numberMaps) {

            if (numberMaps == 2) {

                document.getElementById('map-container').classList.remove("col-md-4");
                document.getElementById('map-container').classList.add("col-md-6");
                document.getElementById('cartogram-container').classList.remove("col-md-4");
                document.getElementById('cartogram-container').classList.add("col-md-6");
                document.getElementById('cartogram-container2').style.display = "none";

                document.getElementsByClassName("main-content")[0].style.paddingLeft = "250px"
            }

            else if (numberMaps == 3) {

                document.getElementById('map-container').classList.remove("col-md-6");
                document.getElementById('map-container').classList.add("col-md-4");
                document.getElementById('cartogram-container').classList.remove("col-md-6");
                document.getElementById('cartogram-container').classList.add("col-md-4");
                document.getElementById('cartogram-container2').style.removeProperty("display");

                document.getElementsByClassName("main-content")[0].style.paddingLeft = "50px"
            }
        },

        load_survey: function(name) {

            if(window.cartogram.model.in_loading_state)
                return Promise.reject();

            return new Promise(function(resolve,reject){

                window.cartsurvey.enter_loading_state();
                window.cartsurvey.http_get(window.cartsurvey.surveys_base_url + "/" + name + "/program.json").then(function(program){

                    window.cartsurvey.program = program;
                    window.cartsurvey.program.name = name;

                    window.cartsurvey.exit_loading_state();
                    resolve();

                }, reject);

            });

        },
        interactivity_message: function(deactivations){
            const features = [
                {'name': 'legend', 'description': 'legend'},
                {'name': 'gridlines', 'description': 'grid lines'},
                {'name': 'selectable', 'description': 'selectable legend'}];

            let enabled_feautures = [];

            features.forEach(function(feature){

                if(!deactivations.includes(feature.name))
                    enabled_feautures.push(feature.description);

            });

            if(enabled_feautures.length == 0)

                return "You have access to no interactive features.";

            else if(enabled_feautures.length == 1)

                return "You have access to the " + enabled_feautures[0] + " feature.";

            else {

                let msg = "You have access to the ";

                for (let i = 0; i < enabled_feautures.length; i++) {

                    msg += enabled_feautures[i];

                    if(i == (enabled_feautures.length - 2))
                        msg += " and ";
                    else if (i != enabled_feautures.length-1)
                        msg += ", ";

                }

                msg += " features.";

                return msg;

            }

        },

        changeMapTitle: function(mapTitle) {

            document.getElementById('map-title').innerText = mapTitle[0] + " Map"
            document.getElementById("cartogram-title").innerText = mapTitle[1] + " Cartogram";

            if (mapTitle.length > 2) {
                document.getElementById("cartogram-title2").innerText = mapTitle[2] + " Cartogram"
            }

        },

        display_question: function(id) {

            if(window.cartogram.model.in_loading_state || this.program === null)
                return;

            var question = this.program.questions[id];

            if(question.hasOwnProperty("interactive"))
            {
                window.cartogram.config.enableLegend = !(question.interactive.deactivate.includes("legend"));
                window.cartogram.config.enableGridlines = !(question.interactive.deactivate.includes("gridlines"));
                window.cartogram.config.enableSelectable = !(question.interactive.deactivate.includes("selectable"));

            }
            else
            {
                /* We assume full interactivity */
                window.cartogram.config.enableLegend = true;
                window.cartogram.config.enableGridlines = true;
                window.cartogram.config.enableSelectable = true;

            }

            if(question.type == "url") {
                window.location = question.url;
            }

            else if(question.type == "population") {

                this.changeLayout(2);
                this.changeMapTitle(question.mapTitle);

                if(question.hasOwnProperty('colors'))
                    window.cartogram.switchMap(question.map, question.map, null, question.colors);
                else
                    window.cartogram.switchMap(question.map, question.map);

                document.getElementById('interactivity-message').innerText = this.interactivity_message(
                    question.hasOwnProperty("interactive") ? question.interactive.deactivate : []);

            }

            else if(question.type == "3maps") {

                this.changeLayout(3);
                this.changeMapTitle(question.mapTitle);

                this.enter_loading_state();
                window.cartogram.showProgressBar();

                if (!Array.isArray(question.data)) {

                    Promise.all([this.http_get(this.data_base_url + "/" + question.data + "_cartogramui.json"),
                        this.http_get(this.data_base_url + "/" + question.data + "_cartogram.json"),
                        window.cartogram.getMapPack(question.map)]).then(function(data){

                        let mappack = data[2];
                        let cartMap = new CartMap(question.map, mappack.config);

                        // Add original version
                        if (mappack.original.hasOwnProperty("bbox")) {

                            const extrema_original = {
                                min_x: mappack.original.bbox[0],
                                min_y: mappack.original.bbox[1],
                                max_x: mappack.original.bbox[2],
                                max_y: mappack.original.bbox[3]
                            };

                            cartMap.addVersion("1-conventional", new MapVersionData(mappack.original.features, extrema_original, mappack.original.tooltip, mappack.abbreviations, mappack.labels, MapDataFormat.GEOJSON, false));

                        } else {
                            cartMap.addVersion("1-conventional", new MapVersionData(mappack.original.features, mappack.original.extrema, mappack.original.tooltip, mappack.abbreviations, null, MapDataFormat.GOCARTJSON, false));
                        }

                        // Add cartogram version
                        let cartogramData;

                        if (data[1].hasOwnProperty("bbox")) {
                            const extrema_cartogram = {
                            min_x: data[1].bbox[0],
                            min_y: data[1].bbox[1],
                            max_x: data[1].bbox[2],
                            max_y: data[1].bbox[3]
                            };

                            cartogramData = new MapVersionData(data[1].features, extrema_cartogram, data[0].tooltip, null, null,
                                MapDataFormat.GEOJSON, false);
                        } else {

                            cartogramData = new MapVersionData(data[1].features, data[1].extrema, data[0].tooltip, null, null,
                                MapDataFormat.GOCARTJSON, false);
                        }

                        cartMap.addVersion("3-cartogram", cartogramData);

                        // Add population version
                        if(mappack.population.hasOwnProperty("bbox")) {

                            const extrema_population = {
                                min_x: mappack.population.bbox[0],
                                min_y: mappack.population.bbox[1],
                                max_x: mappack.population.bbox[2],
                                max_y: mappack.population.bbox[3]
                            };

                            cartMap.addVersion("2-population", new MapVersionData(mappack.population.features, extrema_population, mappack.population.tooltip, null, null, MapDataFormat.GEOJSON, false));

                        } else {
                            cartMap.addVersion("2-population", new MapVersionData(mappack.population.features, mappack.population.extrema, mappack.population.tooltip, null, null, MapDataFormat.GOCARTJSON, false));
                        }

                        let colors = {};

                        Object.keys(cartMap.regions).forEach(function(region_id){

                            if (question.hasOwnProperty("colors")) {

                                colors[region_id] = question.colors[region_id.toString()];

                            } else {

                                colors[region_id] = mappack.colors["id_" + region_id];

                            }

                        }, this);

                        cartMap.colors = colors;

                        cartMap.drawVersion("1-conventional", "map-area", ["map-area", "cartogram-area", "cartogram-area2"]);
                        cartMap.drawVersion("2-population", "cartogram-area", ["map-area", "cartogram-area", "cartogram-area2"]);
                        cartMap.drawVersion("3-cartogram", "cartogram-area2", ["map-area", "cartogram-area", "cartogram-area2"]);

                        window.cartogram.exitLoadingState();
                        document.getElementById('cartogram').style.display = 'block';

                        if (window.cartogram.config.enableSelectable) {
                            cartMap.drawLegend("1-conventional", "map-area-legend");
                            cartMap.drawLegend("2-population", "cartogram-area-legend");
                            cartMap.drawLegend("3-cartogram", "cartogram-area2-legend");

                            cartMap.drawGridLines("1-conventional", "map-area-svg");
                            cartMap.drawGridLines("2-population", "cartogram-area-svg");
                            cartMap.drawGridLines("3-cartogram", "cartogram-area2-svg");
                        }

                        else if (window.cartogram.config.enableGridlines) {

                            cartMap.drawStaticLegend("1-conventional", "map-area-legend");
                            cartMap.drawStaticLegend("2-population", "cartogram-area-legend");
                            cartMap.drawStaticLegend("3-cartogram", "cartogram-area2-legend");

                            cartMap.drawGridLines("1-conventional", "map-area-svg");
                            cartMap.drawGridLines("2-population", "cartogram-area-svg");
                            cartMap.drawGridLines("3-cartogram", "cartogram-area2-svg");
                        }

                        else if (window.cartogram.config.enableLegend) {
                            cartMap.drawStaticLegend("1-conventional", "map-area-legend");
                            cartMap.drawStaticLegend("2-population", "cartogram-area-legend");
                            cartMap.drawStaticLegend("3-cartogram", "cartogram-area2-legend");
                        }

                        else {
                            cartMap.drawTotalValue("1-conventional", "map-area-legend");
                            cartMap.drawTotalValue("2-population", "cartogram-area-legend");
                            cartMap.drawTotalValue("3-cartogram", "cartogram-area2-legend");

                        }

                    }, function(e) {
                        window.cartogram.doFatalError(e);
                    })
                }

                else {
                    Promise.all([this.http_get(this.data_base_url + "/" + question.data[0] + "_cartogramui.json"),
                        this.http_get(this.data_base_url + "/" + question.data[0] + "_cartogram.json"),
                        window.cartogram.getMapPack(question.map),
                        this.http_get(this.data_base_url + "/" + question.data[1] + "_cartogramui.json"),
                        this.http_get(this.data_base_url + "/" + question.data[1] + "_cartogram.json")]).then(function(data){

                        let mappack = data[2];
                        let cartMap = new CartMap(question.map, mappack.config);

                        // Add original version
                        if (mappack.original.hasOwnProperty("bbox")) {

                            const extrema_original = {
                                min_x: mappack.original.bbox[0],
                                min_y: mappack.original.bbox[1],
                                max_x: mappack.original.bbox[2],
                                max_y: mappack.original.bbox[3]
                            };

                            cartMap.addVersion("1-conventional", new MapVersionData(mappack.original.features, extrema_original, mappack.original.tooltip, mappack.abbreviations, mappack.labels, MapDataFormat.GEOJSON, false));

                        } else {
                            cartMap.addVersion("1-conventional", new MapVersionData(mappack.original.features, mappack.original.extrema, mappack.original.tooltip, mappack.abbreviations, null, MapDataFormat.GOCARTJSON, false));
                        }

                        // Add first cartogram version
                        let cartogramData;

                        if (data[1].hasOwnProperty("bbox")) {
                            const extrema_cartogram = {
                            min_x: data[1].bbox[0],
                            min_y: data[1].bbox[1],
                            max_x: data[1].bbox[2],
                            max_y: data[1].bbox[3]
                            };

                            cartogramData = new MapVersionData(data[1].features, extrema_cartogram, data[0].tooltip, null, null,
                                MapDataFormat.GEOJSON, false);
                        } else {

                            cartogramData = new MapVersionData(data[1].features, data[1].extrema, data[0].tooltip, null, null,
                                MapDataFormat.GOCARTJSON, false);
                        }

                        cartMap.addVersion("3-cartogram", cartogramData);

                        // Add second cartogram version
                        let cartogramData2;

                        if (data[4].hasOwnProperty("bbox")) {
                            const extrema_cartogram2 = {
                            min_x: data[4].bbox[0],
                            min_y: data[4].bbox[1],
                            max_x: data[4].bbox[2],
                            max_y: data[4].bbox[3]
                            };

                            cartogramData2 = new MapVersionData(data[4].features, extrema_cartogram2, data[3].tooltip, null, null,
                                MapDataFormat.GEOJSON, false);
                        } else {

                            cartogramData2 = new MapVersionData(data[4].features, data[3].extrema, data[3].tooltip, null, null,
                                MapDataFormat.GOCARTJSON, false);
                        }

                        cartMap.addVersion("4-cartogram2", cartogramData2);

                        let colors = {};

                        Object.keys(cartMap.regions).forEach(function(region_id){

                            if (question.hasOwnProperty("colors")) {

                                colors[region_id] = question.colors[region_id.toString()];

                            } else {

                                colors[region_id] = mappack.colors["id_" + region_id];

                            }

                        }, this);

                        cartMap.colors = colors;

                        cartMap.drawVersion("1-conventional", "map-area", ["map-area", "cartogram-area", "cartogram-area2"]);
                        cartMap.drawVersion("3-cartogram", "cartogram-area", ["map-area", "cartogram-area", "cartogram-area2"]);
                        cartMap.drawVersion("4-cartogram2", "cartogram-area2", ["map-area", "cartogram-area", "cartogram-area2"]);

                        window.cartogram.exitLoadingState();
                        document.getElementById('cartogram').style.display = 'block';

                        if (window.cartogram.config.enableSelectable) {
                            cartMap.drawLegend("1-conventional", "map-area-legend");
                            cartMap.drawLegend("3-cartogram", "cartogram-area-legend");
                            cartMap.drawLegend("4-cartogram2", "cartogram-area2-legend");

                            cartMap.drawGridLines("1-conventional", "map-area-svg");
                            cartMap.drawGridLines("3-cartogram", "cartogram-area-svg");
                            cartMap.drawGridLines("4-cartogram2", "cartogram-area2-svg");
                        }

                        else if (window.cartogram.config.enableGridlines) {

                            cartMap.drawStaticLegend("1-conventional", "map-area-legend");
                            cartMap.drawStaticLegend("3-cartogram", "cartogram-area-legend");
                            cartMap.drawStaticLegend("4-cartogram2", "cartogram-area2-legend");

                            cartMap.drawGridLines("1-conventional", "map-area-svg");
                            cartMap.drawGridLines("3-cartogram", "cartogram-area-svg");
                            cartMap.drawGridLines("4-cartogram2", "cartogram-area2-svg");
                        }

                        else if (window.cartogram.config.enableLegend) {
                            cartMap.drawStaticLegend("1-conventional", "map-area-legend");
                            cartMap.drawStaticLegend("3-cartogram", "cartogram-area-legend");
                            cartMap.drawStaticLegend("4-cartogram2", "cartogram-area2-legend");
                        }

                        else {
                            cartMap.drawTotalValue("1-conventional", "map-area-legend");
                            cartMap.drawTotalValue("3-cartogram", "cartogram-area-legend");
                            cartMap.drawTotalValue("4-cartogram2", "cartogram-area2-legend");

                        }

                    }, function(e) {
                        window.cartogram.doFatalError(e);
                    })
                }

                document.getElementById('interactivity-message').innerText = this.interactivity_message(
                    question.hasOwnProperty("interactive") ? question.interactive.deactivate : []);
            }

            else if(question.type == "cartogram") {

                this.changeLayout(2);
                this.changeMapTitle(question.mapTitle);

                this.enter_loading_state();
                window.cartogram.showProgressBar();

                Promise.all([this.http_get(this.data_base_url + "/" + question.data + "_cartogramui.json"),
                    this.http_get(this.data_base_url + "/" + question.data + "_cartogram.json"),
                    window.cartogram.getMapPack(question.map),
                    window.cartogram.getLabels(question.map),
                    window.cartogram.getConfig(question.map),
                    window.cartogram.getAbbreviations(question.map)]).then(function(data){

                    let mappack = data[2];
                    let cartMap = new CartMap(question.map, mappack.config);

                    // Add original
                    if (mappack.original.hasOwnProperty("bbox")) {

                        const extrema_original = {
                            min_x: mappack.original.bbox[0],
                            min_y: mappack.original.bbox[1],
                            max_x: mappack.original.bbox[2],
                            max_y: mappack.original.bbox[3]
                        };

                        cartMap.addVersion("1-conventional", new MapVersionData(mappack.original.features, extrema_original, mappack.original.tooltip, mappack.abbreviations, mappack.labels, MapDataFormat.GEOJSON, false));

                    }
                    else {
                        cartMap.addVersion("1-conventional", new MapVersionData(mappack.original.features, mappack.original.extrema, mappack.original.tooltip, mappack.abbreviations, mappack.labels, MapDataFormat.GOCARTJSON, false));

                    }

                    // Add cartogram
                    let cartogramData;

                    if (data[1].hasOwnProperty("bbox")) {

                        const extrema_cartogram = {
                        min_x: data[1].bbox[0],
                        min_y: data[1].bbox[1],
                        max_x: data[1].bbox[2],
                        max_y: data[1].bbox[3]
                        };

                        cartogramData = new MapVersionData(data[1].features, extrema_cartogram, data[0].tooltip, null, null,
                            MapDataFormat.GEOJSON, false);
                    } else {

                        cartogramData = new MapVersionData(data[1].features, data[1].extrema, data[0].tooltip, null, null,
                            MapDataFormat.GOCARTJSON, false);
                    }

                    cartMap.addVersion("3-cartogram", cartogramData);

                    // Add colors
                    let colors = {};

                    Object.keys(cartMap.regions).forEach(function(region_id){

                        if (question.hasOwnProperty("colors")) {

                            colors[region_id] = question.colors[region_id.toString()];

                        } else {

                            colors[region_id] = mappack.colors["id_" + region_id];

                        }

                    }, this);

                    cartMap.colors = colors;

                    cartMap.drawVersion("1-conventional", "map-area", ["map-area", "cartogram-area"]);
                    cartMap.drawVersion("3-cartogram", "cartogram-area", ["map-area", "cartogram-area"]);


                    window.cartogram.exitLoadingState();
                    document.getElementById('cartogram').style.display = 'block';

                    if (window.cartogram.config.enableSelectable) {
                        cartMap.drawLegend("1-conventional", "map-area-legend");
                        cartMap.drawLegend("3-cartogram", "cartogram-area-legend");

                        cartMap.drawGridLines("1-conventional", "map-area-svg");
                        cartMap.drawGridLines("3-cartogram", "cartogram-area-svg");
                    }

                    else if (window.cartogram.config.enableGridlines) {

                        cartMap.drawStaticLegend("1-conventional", "map-area-legend");
                        cartMap.drawStaticLegend("3-cartogram", "cartogram-area-legend");

                        cartMap.drawGridLines("1-conventional", "map-area-svg");
                        cartMap.drawGridLines("3-cartogram", "cartogram-area-svg");
                    }

                    else if (window.cartogram.config.enableLegend) {
                        cartMap.drawStaticLegend("1-conventional", "map-area-legend");
                        cartMap.drawStaticLegend("3-cartogram", "cartogram-area-legend");
                    }

                    else {
                        cartMap.drawTotalValue("1-conventional", "map-area-legend");
                        cartMap.drawTotalValue("3-cartogram", "cartogram-area-legend");

                    }


                }, function(e){
                    window.cartogram.doFatalError(e);
                });

                document.getElementById('interactivity-message').innerText = this.interactivity_message(
                    question.hasOwnProperty("interactive") ? question.interactive.deactivate : []);
            }

            else {
                window.cartogram.do_fatal_error("Unrecognized question type '" + question.type + "'.");
            }

            /* Update or hide the next and previous buttons */
            /* This may run before the current question is finished loading, but that's okay */

            if(id == (this.program.questions.length - 1)) {

                document.getElementById('next-button').style.display = 'none';

            } else {
                document.getElementById('next-button').onclick = (function(i){

                    return function(e) {

                        //window.cartsurvey.display_question(i+1);
                        window.location = window.cartsurvey.surveys_ui_base_url + window.cartsurvey.program.name + "/" + (id + 1)

                    };

                }(id));
            }

            if(id == 0)
            {
                document.getElementById('prev-button').style = "display:none";
            }
            else
            {
                document.getElementById('prev-button').onclick = (function(i){

                    return function(e) {

                        //window.cartsurvey.display_question(i-1);
                        window.location = window.cartsurvey.surveys_ui_base_url + window.cartsurvey.program.name + "/" + (id - 1)

                    };

                }(id));
            }

            if(question.hasOwnProperty("question_title"))
            {
                document.getElementById('question-display').innerHTML = question.question_title;
            }
            else
            {
                document.getElementById('question-no').innerText = id + 1;
            }



        }

    };

}