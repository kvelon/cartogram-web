function cartsurvey_init(t_u,d_u,s_u,sui_u,) {

    // window.cartogram.scaling_factor = 1.7;

    window.cartsurvey = {

        threemaps_base_url: t_u,
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
        interactivity_message: function(all_features, deactivations){

            var enabled_feautures = [];

            all_features.forEach(function(feature){

                if(!deactivations.includes(feature.name))
                    enabled_feautures.push(feature.description);

            });

            if(enabled_feautures.length == 0)
                return "You have access to no interactive features.";

            if(enabled_feautures.length == 1)
                return "You have access to the " + enabled_feautures[0] + " feature.";

            var msg = "You have access to the ";

            for(let i = 0; i < enabled_feautures.length; i++)
            {
                if(i == (enabled_feautures.length - 1))
                    msg += " and";

                msg += " " + enabled_feautures[i];

                if(i != (enabled_feautures.length - 1) && enabled_feautures.length != 2)
                    msg += ",";
            }

            msg += " features.";

            return msg;

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

            if(question.hasOwnProperty("hide"))
            {
                window.cartogram.config.hideMapsByID = question.hide;
            }
            else
            {
                window.cartogram.config.hideMapsByID = [];
            }

            if(question.type == "url")
            {
                window.location = question.url;
            }

            else if(question.type == "3maps")
            {
                /* Redirect to the 3maps page. Specify the next URL if necessary */

                var animurl = this.threemaps_base_url + "?hrq=" + (id + 1) + "&handler=" + question.map + "&maps=" + encodeURIComponent(window.btoa(JSON.stringify(question.maps)));

                if(id < (this.program.questions.length - 1))
                {
                    animurl += "&next=" + encodeURIComponent(this.surveys_ui_base_url + this.program.name + "/" + (id + 1));
                }

                if(id != 0)
                {
                    animurl += "&prev=" + encodeURIComponent(this.surveys_ui_base_url + this.program.name + "/" + (id - 1));
                }

                if(question.hasOwnProperty("interactive"))
                {
                    animurl += "&deactivate=" + encodeURIComponent(question.interactive.deactivate.join(","));
                }

                if(question.hasOwnProperty("hide"))
                {
                    animurl += "&hide=" + encodeURIComponent(question.hide.join(","));
                }

                window.location = animurl;
            }
            else if(question.type == "population")
            {
                if(question.hasOwnProperty('colors'))
                    window.cartogram.switchMap(question.map, question.map, null, this.http_get(this.data_base_url + "/" + question.colors + ".json"));
                else
                    window.cartogram.switchMap(question.map, question.map);

                document.getElementById('interactivity-message').innerText = this.interactivity_message([
                    {'name': 'legend', 'description': 'legend'},
                    {'name': 'gridlines', 'description': 'grid lines'},
                    {'name': 'selectable', 'description': 'selectable legend'}
                ], question.hasOwnProperty("interactive") ? question.interactive.deactivate : []);

            }
            else if(question.type == "cartogram")
            {

                this.enter_loading_state();

                Promise.all([this.http_get(this.data_base_url + "/" + question.data + "_cartogramui.json"),
                    this.http_get(this.data_base_url + "/" + question.data + "_cartogram.json"),
                    window.cartogram.getMapPack(question.map),
                    window.cartogram.getLabels(question.map),
                    window.cartogram.getConfig(question.map),
                    window.cartogram.getAbbreviations(question.map)]).then(function(data){

                    let mappack = data[2];
                    let cartMap = new CartMap(question.map, mappack.config);

                    const extrema = {
                                    min_x: data[1].bbox[0],
                                    min_y: data[1].bbox[1],
                                    max_x: data[1].bbox[2],
                                    max_y: data[1].bbox[3]
                                    };

                    window.cartogram.addVersion("3-cartogram", new MapVersionData(data[1].features, extrema,null,
                        mappack.abbreviations,mappack.labels,MapDataFormat.GEOJSON, false))

                    cartMap.drawVersion("1-conventional", "map-area", ["map-area", "cartogram-area"]);
                    cartMap.drawVersion("3-cartogram", "cartogram-area", ["map-area", "cartogram-area"]);

                    window.cartogram.exitLoadingState();

                    // window.cartogram.model.map.colors = data[0].color_data;
                    // window.cartogram.model.map.config = data[3];
                    // // window.cartogram.abbreviations = data[4];

                    // window.cartogram.draw_three_maps(window.cartogram.get_pregenerated_map(question.map, "original"), data[1], window.cartogram.get_pregenerated_map(question.map, "population"), "map-area", "cartogram-area", "Land Area", data[0].tooltip.label, "Human Population",data[2]).then(function(v){
                    //
                    //     window.cartogram.tooltip_clear();
                    //     window.cartogram.tooltip_initialize();
                    //     window.cartogram.tooltip.push(v[0].tooltip);
                    //     window.cartogram.tooltip.push(v[2].tooltip);
                    //     window.cartogram.tooltip.push(data[0].tooltip);
                    //
                    //     window.cartogram.exitLoadingState();
                    //     document.getElementById('cartogram').style.display = 'block';
                    //
                    //     document.getElementById('interactivity-message').innerText = window.cartsurvey.interactivity_message([
                    //         {'name': 'tooltip', 'description': 'infotips'},
                    //         {'name': 'highlight', 'description': 'parallel highlighting'},
                    //         {'name': 'switching', 'description': 'map switching'}
                    //     ], question.hasOwnProperty("interactive") ? question.interactive.deactivate : []);
                    //
                    // }, function(e){
                    //     window.cartogram.doFatalError(e);
                    // });

                }, function(e){
                    window.cartogram.doFatalError(e);
                });
            }
            else if(question.type == "3switchable")
            {
                this.enter_loading_state();

                /*
                "map":"india-no-tg",
                "maps": [{"type":"pregen","name":"original"},
                        {"type":"data","name":"india_pop1961"},
                        {"type":"pregen","name":"population"}
                        ],
                "interactive": {
                    "deactivate": [
                        "tooltip",
                        "highlight"
                    ]
                }
                */

                question.maps.forEach(function(map, index){

                    if(map.type === "pregen")
                    {
                        var promise_array = [
                            window.cartogram.get_pregenerated_map(question.map, map.name),
                            window.cartogram.get_default_colors(question.map)
                        ];

                        if(map.name === "original")
                            promise_array.push(window.cartogram.get_labels(question.map));

                        question.maps[index].promise = Promise.all(promise_array);

                    }
                    else
                    {
                        var promise_array = [
                            window.cartogram.http_get(window.cartsurvey.data_base_url + "/" + map.name + "_cartogram.json"),
                            window.cartogram.http_get(window.cartsurvey.data_base_url + "/" + map.name + "_cartogramui.json")
                        ];

                        question.maps[index].promise = Promise.all(promise_array);
                    }
                });

                Promise.all(question.maps.map(map => map.promise)).then(function(mps){

                    mps.forEach(function(mp, index){

                        question.maps[index].map = mp[0];

                        if(question.maps[index].type == "pregen")
                        {
                            question.maps[index].colors = mp[1];
                            question.maps[index].tooltip = mp[0].tooltip;

                            if(question.maps[index].name === "original")
                                question.maps[index].labels = mp[2];
                        }
                        else
                        {
                            question.maps[index].colors = mp[1].color_data;
                            question.maps[index].tooltip = mp[1].tooltip;
                        }

                    });

                    window.cartogram.get_config(question.map).then(function(map_config){

                        // Pull color data from the second map.
                        window.cartogram.color_data = question.maps[1].colors;
                        window.cartogram.map_config = map_config;

                        /* Due to limitations of cartogram.js, we can only display labels
                           on the first map.
                        */

                        window.cartogram.draw_three_maps(question.maps[0].map, question.maps[1].map, question.maps[2].map, "map-area", "cartogram-area", question.maps[0].tooltip.label, question.maps[1].tooltip.label, question.maps[2].tooltip.label, question.maps[0].hasOwnProperty("labels") ? question.maps[0].labels : null).then(function(v){

                            window.cartogram.tooltip_clear();
                            window.cartogram.tooltip_initialize();
                            window.cartogram.tooltip.push(question.maps[0].tooltip);
                            window.cartogram.tooltip.push(question.maps[1].tooltip);
                            window.cartogram.tooltip.push(question.maps[2].tooltip);

                            window.cartogram.exit_loading_state();
                            document.getElementById('cartogram').style.display = 'block';

                            document.getElementById('interactivity-message').innerText = window.cartsurvey.interactivity_message([
                                {'name': 'tooltip', 'description': 'infotips'},
                                {'name': 'highlight', 'description': 'parallel highlighting'},
                                {'name': 'switching', 'description': 'map switching'}
                            ], question.hasOwnProperty("interactive") ? question.interactive.deactivate : []);

                        }, function(e){
                            window.cartogram.do_fatal_error(e);
                        });

                    }, function(e){
                        window.cartogram.do_fatal_error(e);
                    });


                }, function(e){
                    window.cartogram.do_fatal_error(e);
                });


            }
            else
            {
                window.cartogram.do_fatal_error("Unrecognized question type '" + question.type + "'.");
            }

            /* Update or hide the next and previous buttons */
            /* This may run before the current question is finished loading, but that's okay */

            if(id == (this.program.questions.length - 1))
            {
                document.getElementById('next-button').style.display = 'none';
            }
            else
            {
                document.getElementById('next-button').onclick = (function(i){

                    return function(e) {

                        //window.cartsurvey.display_question(i+1);
                        window.location = window.cartsurvey.surveys_ui_base_url + window.cartsurvey.program.name + "/" + (id + 1)

                    };

                }(id));
            }

            if(id == 0)
            {
                document.getElementById('prev-button').style.display = 'none';
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