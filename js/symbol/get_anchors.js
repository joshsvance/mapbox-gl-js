'use strict';

var interpolate = require('../util/interpolate');
var Anchor = require('../symbol/anchor');
var checkMaxAngle = require('./check_max_angle');

module.exports = getAnchors;

function getAnchors(line, spacing, maxRepeatDistance, maxAngle, shapedText, shapedIcon, glyphSize, boxScale, overscaling) {

    // Resample a line to get anchor points for labels and check that each
    // potential label passes text-max-angle check and has enough froom to fit
    // on the line.

    var angleWindowSize = shapedText ?
        3 / 5 * glyphSize * boxScale :
        0;

    // Offset the first anchor by half the label length, plus either the -repeat-distance length
    // (if the line continued from outside the tile boundary), or a set extra offset.

    /* 
    // Not sure if this works. Rewrote as nested if/else statement.
    var labelLength = shapedText && shapedIcon ?
        Math.max(shapedText.right - shapedText.left, shapedIcon.right - shapedIcon.left) :
        shapedText ?
        shapedText.right - shapedText.left :
        shapedIcon.right - shapedIcon.left;
        */

    if (shapedText) {
        if (shapedIcon) {
            var labelLength = Math.max(shapedText.right - shapedText.left, shapedIcon.right - shapedIcon.left); 
        } else {
            var labelLength = shapedText.right - shapedText.left;
        } 
    } else {
        var labelLength = shapedIcon.right - shapedIcon.left;
    }   

    // Add a bit of extra offset to avoid collisions at T intersections.
    var extraOffset = glyphSize * 2;

    // Is the line continued from outside the tile boundary?
    if ((line[0].x == (0 || 4096)) || (line[0].y == (0 || 4096))) {
        var continuedLine = true;
    }

    //(continuedLine) { console.log(firstPoint.x + " " + firstPoint.y + " " + continuedLine); }
    //var offset = (repeatDistance > 0 && continuedLine) ? 
    // Maybe add another condition to use repeatDistance value first if there is one
      var offset = continuedLine ? 
        ((labelLength / 2 * boxScale + spacing / 2) * overscaling) % spacing :
        ((labelLength / 2 + extraOffset) * boxScale * overscaling) % spacing;    

    //if ((labelLength * boxScale) > spacing && continuedLine) { console.log((labelLength * boxScale) + " " + spacing + " " + offset); }

    return resample(line, offset, spacing, angleWindowSize, maxAngle, labelLength * boxScale, continuedLine, false);
}


function resample(line, offset, spacing, angleWindowSize, maxAngle, labelLength, continuedLine, placeAtMiddle) {

    var distance = 0,
        markedDistance = offset ? offset - spacing : 0,
        longLabelPadding = 400;  

    if (spacing - labelLength < longLabelPadding ) {
            //console.log(spacing)
            spacing += longLabelPadding; // does this work with the second anchor placement attempt?
            //console.log(spacing);
        }

    var anchors = [];

    for (var i = 0; i < line.length - 1; i++) {

        var a = line[i],
            b = line[i + 1];

        var segmentDist = a.dist(b),
            angle = b.angleTo(a);

        while (markedDistance + spacing < distance + segmentDist) {
            markedDistance += spacing;

            var t = (markedDistance - distance) / segmentDist,
                x = interpolate(a.x, b.x, t),
                y = interpolate(a.y, b.y, t);

            if (x >= 0 && x < 4096 && y >= 0 && y < 4096) {
                var anchor = new Anchor(x, y, angle, i);

                if (!angleWindowSize || checkMaxAngle(line, anchor, labelLength, angleWindowSize, maxAngle)) {
                    anchors.push(anchor);
                }
            }
        }

        distance += segmentDist;
    }

    if (!placeAtMiddle && !anchors.length && !continuedLine) {
        // The first attempt at finding anchors at which labels can be placed failed.
        // Try again, but this time just try placing one anchor at the middle of the line.
        // This has the most effect for short lines in overscaled tiles, since the
        // initial offset used in overscaled tiles is calculated to align labels with positions in
        // parent tiles instead of placing the label as close to the beginning as possible.
        anchors = resample(line, distance / 2, spacing, angleWindowSize, maxAngle, labelLength, continuedLine, true);
    }

    return anchors;
}
