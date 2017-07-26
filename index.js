'use strict';

document.addEventListener("DOMContentLoaded", function(){
    buildChart();
});

function buildChart() {
  // ------------------------------------------------------------------------------
  // GET TIME RANGE AND SERVICE TYPE, BUILD API QUERY
  // ------------------------------------------------------------------------------
  function getTimeRange(){
    // Creates a week time range and formats dates for 311 API requests
      let week = new Date();
          week.setDate(week.getDate() - 7);
      let range = formatRequestDate(week);
      return range;

    // helper function to format dates correctly for 311 API request
    function formatRequestDate(date){
      function cleanDate(input) {
        return (input < 10) ? '0' + input : input;
      }
      // Format date string 'YYYY-mm-dd'
      let formatDate = date.getFullYear() + '-' 
      + cleanDate((date.getMonth() + 1)) + '-' 
      + cleanDate((date.getDate()));

      return formatDate;
    }
  }

  function getWeekList() {
    // identify the last seven days for y axis labels!
    let weekArr = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    let day = new Date();
    let j = day.getDay();
    let newWeekArr = [];

    for (var i = 0; i < 7; i++) {
      weekArr[j] == undefined ? j = 0 : j = j;
      newWeekArr.push(weekArr[j]);
      j++;
    }
    return newWeekArr;
  }

  function getTitle() {
    // construct dynamic subtitle based on selected request type
    const category_elm = document.getElementById("chart-filter__service-type"),
          category_text = category_elm.options[category_elm.selectedIndex].text,
          lastWeek = new Date(),
          yesterday = new Date();
    let title = '';

    // get the dates for 7 days ago and yesterday
    lastWeek.setDate(lastWeek.getDate() - 7);
    yesterday.setDate(yesterday.getDate() - 1);

    // build and assign subtitle
    title = category_text + ' requests from ' + formatTitleDate(lastWeek) + ' to ' + formatTitleDate(yesterday);
    document.getElementsByClassName('title--sub')[0].innerText = title;

    function formatTitleDate(date) {
      function cleanDate(input) {
        return (input < 10) ? '0' + input : input;
      }
      // Format date string: 'mm/dd'
      let formatDate = cleanDate((date.getMonth() + 1)) + '/' 
      + cleanDate((date.getDate()));

      return formatDate;
    }
  };
  getTitle();
  document.getElementById("chart-filter__service-type").addEventListener('change', function() { getTitle(); })

  function getD3url(queryString){
    let url = "https://data.phila.gov/resource/4t9v-rppq.json?$where=" + queryString;
    return url;
  }

  function createQuery() {
    var queryStringsArray = [];

    //get timerange
    var timeRange = getTimeRange();
    var serviceQuery = '';
    if (timeRange.length > 0) {
      serviceQuery = "requested_datetime>='" + timeRange + "'";
      queryStringsArray.push(serviceQuery);
    }

    //get request id number
    var serviceNo = document.getElementById("chart-filter__service-type").value;
    var serviceQuery = '';
    if (serviceNo.length > 0) {
      serviceQuery = "service_code='" + serviceNo + "'";
      queryStringsArray.push(serviceQuery);
    }

    var queryString = queryStringsArray.join(' AND ');
    if (queryString.length > 0) {
      var url = getD3url(queryString);
      getD3(url);  
      console.log(url);
    }
  }
  createQuery();

  // watch for changes to dropdown selection
  document.getElementById("chart-filter__service-type").onchange=selectChangeEventHandler;
  function selectChangeEventHandler(event) {
    createQuery();
  }


  // ------------------------------------------------------------------------------
  // GET DATA AND BUILD SVG CHART!
  // ------------------------------------------------------------------------------ 

  function getD3(url) {
    d3.select('.chart__day-time').remove(); // if graph is there, clear it out before building another

    const margin = { top: 50, right: 0, bottom: 100, left: 30 },
    width = 960 - margin.left - margin.right,
    height = 430 - margin.top - margin.bottom,
    gridSize = Math.floor(width / 24),
    legendElementWidth = gridSize*2,
    buckets = 5,
    colors = ['#edf8fb', '#b3cde3', '#8c96c6', '#8856a7', '#810f7c'],
    days = getWeekList(),
    times = ["12a", "1a", "2a", "3a", "4a", "5a", "6a", "7a", "8a", "9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p", "10p", "11p"],
    dataURL = url;

    // parse the date to create Date object
    var parseDate = d3.timeParse("%Y-%m-%dT%H:%M:%SZ");
    var parseDay = d3.timeParse("%Y-%m-%dT%H");

    // format Date objects
    var formatDay = d3.timeFormat("%d");
    var formatHour = d3.timeFormat("%H");
    var formatDayHour = d3.timeFormat("%Y-%m-%dT%H");
    var formatCountDate = d3.timeFormat("%d");

    const svg = d3.select("#chart").append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .attr('class', 'chart__day-time')
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    const dayLabels = svg.selectAll(".dayLabel")
      .data(days)
      .enter().append("text")
        .text(function (d) { return d; })
        .attr("x", 0)
        .attr("y", (d, i) => i * gridSize)
        .style("text-anchor", "end")
        .attr("transform", "translate(-6," + gridSize / 1.5 + ")")
        .attr("class", "dayLabel mono axis axis-workweek");

    const timeLabels = svg.selectAll(".timeLabel")
      .data(times)
      .enter().append("text")
        .text((d) => d)
        .attr("x", (d, i) => i * gridSize)
        .attr("y", 0)
        .style("text-anchor", "middle")
        .attr("transform", "translate(" + gridSize / 2 + ", -6)")
        .attr("class", (d, i) => ((i >= 8 && i <= 17) ? "timeLabel mono axis axis-worktime" : "timeLabel mono axis"));

    // GET DATA
    d3.json(dataURL)
      .on("progress", function() {
      document.getElementsByClassName('loader')[0].classList.remove("hide");
    })
    .get(function(error, data) {
      document.getElementsByClassName('loader')[0].classList.add("hide");

      if (data.length > 0) {
        data.forEach(function(d) {
          // add new properties with formatted dates
          d.date = parseDate(d.requested_datetime);
          d.dayHourFormat = formatDayHour(d.date);
          d.dayCount = formatCountDate(d.date);
        });

        // # of reqs / date
        var reqDateCount = d3.nest()
          .key(function(d) { return d.dayCount; }).sortKeys(d3.ascending)
          .rollup(function(v){ return {
            "count": v.length }
          })
          .entries(data);

        // # of reqs / date and hour
        var reqsPerDay = d3.nest()
          .key(function(d) { return d.dayHourFormat; }).sortKeys(d3.ascending)
          .key(function(d) { return d["service_name"]; })
          .rollup(function(v) { return {
            "count": v.length } 
          })
          .entries(data);

        // # of reqs / hour / day
        reqsPerDay.forEach(function(d) {
          d.value = +d.values[0].value.count;
          d.hour = formatHour(parseDay(d.key));

          reqDateCount.forEach(function(day, i) {
            let dateNum = formatDay(parseDay(d.key));
            let weekCount = day.key;
            if ( dateNum == weekCount ) { d.day = i; }
          });    
        });
        console.log(reqsPerDay);

        const colorScale = d3.scaleQuantile()
          .domain([0, buckets - 1, d3.max(reqsPerDay, (d) => d.value)])
          .range(colors);

        const cards = svg.selectAll(".hour")
            .data(reqsPerDay, (d) => d.day+':'+d.hour);

        cards.append("title");

        cards.enter().append("rect")
            .attr("x", (d) => (d.hour) * gridSize)
            .attr("y", (d) => (d.day) * gridSize)
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("class", "hour bordered")
            .attr("width", gridSize)
            .attr("height", gridSize)
            .style("fill", colors[0])
          .merge(cards)
            .transition()
            .duration(1000)
            .style("fill", (d) => colorScale(d.value));

        cards.select("title").text((d) => d.value);

        cards.exit().remove();

        // create legend
        const legend = svg.selectAll(".legend")
            .data([0].concat(colorScale.quantiles()), (d) => d);

        const legend_g = legend.enter().append("g")
            .attr("class", "legend");

        legend_g.append("rect")
          .attr("x", (d, i) => legendElementWidth * i)
          .attr("y", height)
          .attr("width", legendElementWidth)
          .attr("height", gridSize / 2)
          .style("fill", (d, i) => colors[i]);

        legend_g.append("text")
          .attr("class", "mono")
          .text((d) => Math.round(d) == 0 ? "> " + Math.round(d) : "≥ " + Math.round(d))
          .attr("x", (d, i) => legendElementWidth * i)
          .attr("y", height + gridSize);

        legend.exit().remove();
      } else {
        // TO DO: add no data message in svg
        console.log('no data');
      } 
    });
  }
}

