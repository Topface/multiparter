var _     = require("underscore");
var async = require("async");


(function(exports) {
    var NEW_LINE       = "\r\n",
        TWO_DASH       = "--",
        CONTENT_TYPE   = "Content-Type",
        CONTENT_LENGTH = "Content-Length",
        HEADER_FIELD   = "Content-Disposition: form-data; name=\"%s\"",
        HEADER_FILE    = "Content-Disposition: form-data; name=\"%s\"; " +
                         "filename=\"%s\"" + NEW_LINE + "Content-Type: %s";

    var request = function(protocol, options) {
        var boundary = this.getBoundary(),
            headers;

        this.streams  = {};
        this.params   = {};
        this.protocol = protocol;
        this.options  = options;
        this.length   = TWO_DASH.length * 2 + boundary.length;

        if (!this.options.headers) {
            this.options.headers = {};
        }

        headers = this.options.headers

        if (!headers[CONTENT_TYPE]) {
            headers[CONTENT_TYPE] = "multipart/form-data; boundary=" + boundary;
        }
    };

    request.prototype.getBoundary = function() {
        if (!this.boundary) {
            this.boundary = "MyMegaCoolFuckingBoundaryBleat";
        }

        return this.boundary;
    };

    request.prototype.setParam = function(name, value) {
        this.params[name] = value;

        this.addParamLength(name.length, value.length);
    };

    request.prototype.addParamLength = function(nameSize, valueSize) {
        this.length += TWO_DASH.length + this.boundary.length +
                       (NEW_LINE.length * 4) + valueSize + nameSize +
                       (HEADER_FIELD.length - 2);
    };

    request.prototype.addStream = function(name, file, type, size, stream) {
        stream.pause();

        this.streams[name] = {
            length : size,
            stream : stream,
            type   : type,
            file   : file
        };

        this.addFileLength(Buffer.byteLength(name), size, type.length);
    };

    request.prototype.addFileLength = function(nameSize, valueSize, typeSize) {
        this.length += TWO_DASH.length + this.getBoundary().length +
                       (NEW_LINE.length * 6) + valueSize + nameSize +
                       (HEADER_FILE.length - 6) + typeSize;
    };

    request.prototype.send = function(callback) {
        var self     = this,
            called   = false,
            boundary = this.boundary,
            protocol = this.protocol,
            writers,
            request;

        var s = require("fs").createWriteStream("test.txt");

        function wrappedCallback() {
            if (called) {
                return;
            }

            called = true;

            callback.apply(callback, arguments);
        }

        self.options.headers[CONTENT_LENGTH] = self.length;

        request = protocol.request(self.options, function(response) {
            wrappedCallback(undefined, response);
        });

        request.on("error", wrappedCallback);

        _.each(self.params, function(value, key) {
            request.write(TWO_DASH + boundary + NEW_LINE);
            request.write(HEADER_FIELD.replace("%s", key));
            request.write(NEW_LINE + NEW_LINE);
            request.write(value + NEW_LINE);
        });

        writers = _.map(_.keys(self.streams), function(name) {
            return self.writeStream.bind(self, request, name);
        });

        async.series(writers, function(error) {
            if (error) {
                return wrappedCallback(error);
            }

            request.end(TWO_DASH + boundary + TWO_DASH);
        });
    };

    request.prototype.writeStream = function(request, name, callback) {
        var stream   = this.streams[name],
            boundary = this.getBoundary();

        request.write(TWO_DASH + boundary + NEW_LINE);
        request.write(HEADER_FILE.replace("%s", name)
                                 .replace("%s", stream.file)
                                 .replace("%s", stream.type));
        request.write(NEW_LINE + NEW_LINE);

        stream.stream.on("error", callback);

        stream.stream.on("data", function(chunk) {
            request.write(chunk);
        });

        stream.stream.on("end", function() {
            request.write(NEW_LINE);
            callback();
        });

        stream.stream.resume();
    };

    exports.request = request;
})(module.exports);
