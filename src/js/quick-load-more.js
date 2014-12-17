// ## quick-load-more

// quick-load-more, or QLM, enables faster user response times in "load more"
// scenarios. It achieves this by preemptively issuing requests to load more
// items and returning them on user request. It maintains a local cache and 
// aims to keep it populated above a certain number of items.

// ## Usage

// Instantiate `QLM` using a `config` object.

// After instantiantion, just call the `get()` method with the number of items needed.

// example:

// ```
// var qlm = new QLM({serviceURL: '/api/v1/products.json'});
// qlm.get(10).then(function(items){
//   // do something with the items here    
// });
// // This will trigger qlm.loadStarted and qlm.loadFinished events.

// * `serviceURL`: The only required parameter. Contains the URL to the JSON endpoint for the items.
// * `lowItemThreshold`: When the item count is less than this value, a background request will be issued to load more items. Default: 20
// * `parameterState`: A set of key/value pairs to pass to the service as query parameters. Defaults to `start: 0` and `count: 20`
// * `responseItemExtractor`: A function that transforms the AJAX response from `serviceURL` to an array of items. A default implementation is provided, and it just returns the `items` property in the response.
// * `fieldNames`: A set of key field names used to construct URLS.
//   * `start`: name for the start parameter, used to indicate the index of the first element to return from the service. Defaults to: `start`
//   * `count`: name for the count parameter, used to indicate the number of items to return from the service. Defaults to: `count`
// * `event`: a configuration object for the events emitted by this component
//   * `namespace`: the prefix for all the events emitted.
//   * `names`
//     * `loadStarted`: the name for the load started event. Useful for displaying a loading icon. Defaults to 'loadStarted'.
//     * `loadFinished`: the name for the load finished event. Useful for hiding a loading icon. Defaults to 'loadFinished'.
//     * `error`: the name for the error event. Triggered on a server error. Defaults to 'error'.
//     * `exhausted`: the name for the exhaustion event. Triggered when there are no more items even on the server. Defaults to 'exhausted'.




var QLM = (function($){
    return function(customConfig){
        "use strict";

        // The only critically required parameter is `serviceURL`, and 
        // we should make this as clear as possible.
        if(!customConfig.serviceURL){
            throw new Error('No service URL provided.');
        }

        // ## Configuration

        // To make QLM work, you'll need to provide `serviceURL`, the URL of your AJAX endpoint. You'll most likely
        // have to provide implementations for `paginator`, `isServerExhausted` and `extractItems` depending on your
        // pagination strategy.

        // This is the default config object, to be extended with the config the user provides.
        var config = {

            // ### Miscellaneous configuration

            // When the item count is less than this value, a background request will be issued to load more items.
            lowItemThreshold: 20,

            // Configuration of events emitted by this component
            event: {

                // The prefix for the events
                namespace: 'qlm',

                // The names for the events
                names: {

                    // This will be triggered when loading starts, but not for background requests
                    loadStarted: 'loadStarted',

                    // This will be triggered when loading finishes, but not for background requests
                    loadFinished: 'loadFinished',
                    
                    // This will be triggered in case of AJAX errors 
                    error: 'error',
                    
                    // This will be triggered if it's not possible to return any more items
                    exhausted: 'exhausted'
                }
            },

            // The query parameters (if any), to be used when making requests to the server.
            // The parameters can be set after using the `setParameter` method.
            queryParameters: {},

            // ### The paginator object

            // The paginator object is responsible to keep track of the pagination state and provide
            // a means to calculate the next state, given the previous state.

            // A default paginator implementation is provided. It uses `start` and `count` parameters
            // to paginate queries.
            paginator: {

                // The paginator state. The key-value pairs inside will be serialized into the URL as
                // query parameters, so the schema of the `state` object will reflect your pagination
                // strategy.
                state: {
                    start: 0,
                    count: 50
                },

                // Given a state, calculate and return the next state. Ideally, this function shouldn't
                // have any side effects.
                next: function(currentState){
                    currentState.start += currentState.count;
                    return currentState;
                }
            },

            //  ### Item exhaustion detection

            // To know when to stop querying the server, a means of determining whether there are no more
            // items to return from the server should be provided. This function, given a server response,
            // should return a boolean indicating whether the server ran out of items.

            // A default implementation is provided here.
            isServerExhausted: function(response){
                return response.exhausted;
            },

            // ### Item extraction

            // To populate the local cache, QLM needs a means of extracting items from the response. This
            // function, given a server response, should return an array of items.

            // A default implementation is provided here.
            extractItems: function(response){
                return response.items;
            }

        };


        // Augment the default configuration using user-supplied values, overriding when possible
        $.extend(true, config, customConfig);
        

        // The item storage
        var localCache = [],

            // shortcuts to the functions in the config
            paginator = config.paginator,
            isServerExhausted = config.isServerExhausted,
            extractItems = config.extractItems,

            // The promise object of the ongoing server request (if any)
            ongoingRequestPromise = null,

            // Issues a GET request to the server, to populate the local cache.
            populateLocalCache = function(){
                return $.ajax({
                    url: getURL(config.queryParameters, paginator.state),
                    type: "GET"
                }).then(function(response){
                    ongoingRequestPromise = null;
                    
                    // extract items from the response
                    var items = extractItems(response);
                    
                    // append the items to the local cache
                    Array.prototype.push.apply(localCache, items);
                    
                    // move the pagination state forward
                    paginator.state = paginator.next(paginator.state);

                    // trigger the exhaustion event if necessary
                    if(isServerExhausted(response)){
                        triggerEvent('exhausted');
                    }

                    // return retrieved items count
                    return items.length;

                }, function(error){
                    ongoingRequestPromise = null;
                    return error;
                });
            },

            // Constructs an URL from the current state, i.e. query parameters and the pagination state.
            // For each `state`, query parameters in the form of`key=value` will be generated from
            // `key: value` pairs in the `state` objects.
            getURL = function(parameters, paginatorState){

                // this array will hold all the query parameters in the `key=value` form
                var queryParameters = [];
                
                // For both parameters and paginationState
                $.each(arguments, function(index, argument){

                    // For each key in the state object
                    $.each(argument, function(parameterName, value){

                        var queryParameter = '';

                        // When serializing an array of form `a = [1,2,3]`, the format `a=1&a=2&a=3` is used
                        if($.isArray(value)){
                            queryParameter = $.map(value, function(v){ return parameterName + '=' + v; }).join('&');
                        }else{
                            queryParameter = parameterName + '=' + value;
                        }

                        queryParameters.push(queryParameter);
                    });
                });

                return config.serviceURL + '?' + queryParameters.join('&');
            },

            // Sets a query parameter to be used in the next request
            setParameter = function(parameter, value){
                config.parameterState[parameter] = value;
            },

            // Gets the value of a query parameter
            getParameter = function(parameter){
                return config.parameterState[parameter];
            },

            // Returns an array containing the specified number of items. The size of the returned
            // list may be less than `numberOfItems` if not enough items exist.
            get = function(numberOfItems){

                // If a background request is already being made to the server, reuse the promise, and attach the callback to its chain
                if (ongoingRequestPromise) {
                    return ongoingRequestPromise.then(function () {
                        return get(numberOfItems);
                    });
                }
    
                // if the number of items in the local cache is insufficent 
                if(localCache.length < numberOfItems){

                    // create a chainer, to check if we have enough items after a server response, and
                    // reissue a request if more items are needed.
                    var chainer = createPromiseChainer({
                        predicate: function(){
                            return localCache.length < numberOfItems;
                        },
                        promiseFn: populateLocalCache
                    });

                    // trigger the load started event.
                    triggerEvent('loadStarted');

                    // populate the local cache, issuing a request to the server
                    ongoingRequestPromise = populateLocalCache().then(function(){
                        // get more items if needed
                        return chainer();
                    }).then(function(retrievedItemCount){
                        // get and remove items from the local cache, starting from the beginning 
                        var items = localCache.splice(0, numberOfItems);

                        // trigger the load finished event
                        triggerEvent('loadFinished');

                        return items;
                    }, function(error){
                        triggerEvent('loadFinished');
                        triggerEvent('error');
                    });

                    // we'll return the current promise to allow attaching of then() calls 
                    return ongoingRequestPromise;
                }

                // if we have enough items in the local cache 
                var result = new $.Deferred(),

                // get and remove items from the local cache, starting from the beginning 
                    items = localCache.splice(0, numberOfItems);

                // attach the items to the deferred and resolve it 
                result.resolve(items);
                    
                // if we're running low on items, issue a background request
                if(localCache.length < config.lowItemThreshold){
                    ongoingRequestPromise = populateLocalCache();
                }

                return result;
            },

            // trigger an event with the given name
            triggerEvent = function(event){
                var eventName = config.event.namespace + '.' + config.event.names[event];
                $(document).trigger(eventName);
            },

            // TODO: extract this to its own module
            createPromiseChainer = function(options){
                return function chainer(){
                    if(options.predicate()){
                        var promise =  options.promiseFn();
                        return promise.then(chainer);
                    }else{
                        var result =  new $.Deferred();
                        result.resolve();
                        return result;
                    }
                };
            };            
        return {
            get: get,
            __getURL: getURL,
            __localCache: localCache
        };
    };
})(jQuery);