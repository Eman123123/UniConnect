const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const pdfParse = require('pdf-parse');

const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});
// Extract deadline dates from calendar data
function extractDeadlines(calendarData, university) {
    const deadlines = [];
    
    // Common deadline keywords
    const deadlineKeywords = [
        'admission', 'application', 'registration', 'apply', 'submit',
        'last date', 'deadline', 'due date', 'closing date', 'final date',
        'commencement', 'start', 'begin', 'orientation'
    ];
    
    // Process events based on university
    if (university === 'FAST' && calendarData.fallSemester) {
        // FAST deadlines
        if (calendarData.fallSemester.registration) {
            deadlines.push({
                event: 'Fall Semester Registration',
                date: calendarData.fallSemester.registration,
                type: 'registration'
            });
        }
        if (calendarData.fallSemester.firstDayOfClasses) {
            deadlines.push({
                event: 'Fall Semester Classes Start',
                date: calendarData.fallSemester.firstDayOfClasses,
                type: 'academic'
            });
        }
    }
    
    if (university === 'LUMS' && calendarData.events) {
        // LUMS deadlines
        calendarData.events.forEach(event => {
            const lowerDesc = (event.description + event.type).toLowerCase();
            if (lowerDesc.includes('deadline') || lowerDesc.includes('last day') || 
                lowerDesc.includes('fee payment') || lowerDesc.includes('registration')) {
                deadlines.push({
                    event: event.description.substring(0, 100),
                    date: event.date,
                    type: event.type.toLowerCase()
                });
            }
        });
    }
    
    if (university === 'UCP' && calendarData.events) {
        // UCP deadlines
        calendarData.events.forEach(event => {
            const lowerEvent = event.event.toLowerCase();
            if (lowerEvent.includes('last date') || lowerEvent.includes('deadline') ||
                lowerEvent.includes('registration') || lowerEvent.includes('payment')) {
                deadlines.push({
                    event: event.event,
                    date: event.date,
                    type: 'deadline'
                });
            }
        });
    }
    
    return deadlines;
}

// Parse date strings to Date objects
function parseDeadlineDate(dateString, year = new Date().getFullYear()) {
    // Try different date formats
    const patterns = [
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:,?\s+(\d{4}))?/i,
        /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
        /(\d{4})-(\d{2})-(\d{2})/
    ];
    
    for (const pattern of patterns) {
        const match = dateString.match(pattern);
        if (match) {
            if (pattern.toString().includes('Jan|Feb')) {
                const months = { 'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5, 
                                 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 };
                const month = months[match[1].substring(0, 3)];
                const day = parseInt(match[2]);
                const yearMatch = match[3] ? parseInt(match[3]) : year;
                return new Date(yearMatch, month, day);
            } else if (pattern.toString().includes('/')) {
                return new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
            } else if (pattern.toString().includes('-')) {
                return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
            }
        }
    }
    return null;
}
// ==================== ACADEMIC CALENDAR SCRAPER ====================

// FAST Academic Calendar
async function scrapeFASTCalendar() {
    try {
        console.log('📅 Fetching FAST academic calendar...');
        const calendars = [];
        
        const url = 'https://nu.edu.pk/Student/Calender';
        
        try {
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 15000,
                httpsAgent: httpsAgent
            });
            
            if (response.status === 200) {
                const $ = cheerio.load(response.data);
                
                // Dynamic data extraction
                const springData = {};
                const fallData = {};
                const holidays = [];
                
                // Find all tables on the page
                $('table').each((tableIndex, table) => {
                    const tableHtml = $(table).html();
                    const tableText = $(table).text();
                    
                    // Check if this is the academic schedule table
                    if (tableText.includes('Spring') && tableText.includes('Fall')) {
                        let currentSemester = '';
                        let headers = [];
                        
                        // Extract column headers to determine which column is Spring and which is Fall
                        $(table).find('thead tr th').each((colIndex, th) => {
                            const headerText = $(th).text().trim();
                            if (headerText) {
                                headers.push(headerText);
                            }
                        });
                        
                        // Determine which column index is Spring and which is Fall
                        let springColIndex = -1;
                        let fallColIndex = -1;
                        
                        headers.forEach((header, idx) => {
                            if (header.toLowerCase().includes('spring')) springColIndex = idx;
                            if (header.toLowerCase().includes('fall')) fallColIndex = idx;
                        });
                        
                        // Parse table rows
                        $(table).find('tbody tr').each((rowIndex, row) => {
                            const cells = $(row).find('td');
                            if (cells.length >= 2) {
                                let eventName = '';
                                let springValue = '';
                                let fallValue = '';
                                
                                cells.each((cellIndex, cell) => {
                                    const cellText = $(cell).text().trim();
                                    
                                    // First column is usually the event name
                                    if (cellIndex === 0) {
                                        eventName = cellText;
                                    }
                                    // Map to appropriate semester based on header positions
                                    else if (springColIndex !== -1 && cellIndex === springColIndex) {
                                        springValue = cellText;
                                    }
                                    else if (fallColIndex !== -1 && cellIndex === fallColIndex) {
                                        fallValue = cellText;
                                    }
                                    // If no headers found, assume column 1 is Spring, column 2 is Fall
                                    else if (springColIndex === -1 && cellIndex === 1) {
                                        springValue = cellText;
                                    }
                                    else if (fallColIndex === -1 && cellIndex === 2) {
                                        fallValue = cellText;
                                    }
                                });
                                
                                if (eventName && (springValue || fallValue)) {
                                    // Create a key from the event name (convert to camelCase for object property)
                                    const key = eventName
                                        .toLowerCase()
                                        .replace(/[^\w\s]/g, '')
                                        .replace(/\s+(.)/g, (match, letter) => letter.toUpperCase())
                                        .replace(/\s/g, '');
                                    
                                    if (springValue) {
                                        springData[key || eventName] = springValue;
                                    }
                                    if (fallValue) {
                                        fallData[key || eventName] = fallValue;
                                    }
                                }
                            }
                        });
                    }
                    
                    // Check if this is the holidays table
                    if (tableText.includes('Kashmir') || tableText.includes('Eid') || tableText.includes('Holidays')) {
                        let currentYear = '';
                        const holidayNames = [];
                        
                        // First, extract all possible holiday names from the first column
                        $(table).find('tbody tr').each((rowIndex, row) => {
                            const cells = $(row).find('td, th');
                            if (cells.length >= 2) {
                                const firstCell = $(cells[0]).text().trim();
                                const secondCell = $(cells[1]).text().trim();
                                const thirdCell = cells.length > 2 ? $(cells[2]).text().trim() : '';
                                
                                // Check if this row contains a year
                                if (firstCell.match(/^\d{4}$/)) {
                                    currentYear = firstCell;
                                }
                                
                                // Check if this is a holiday (not a year or empty)
                                if (firstCell && !firstCell.match(/^\d{4}$/) && firstCell.length > 2 && firstCell.length < 50) {
                                    let date = secondCell || thirdCell;
                                    if (date && date.trim() && !date.includes('*')) {
                                        // Check if this holiday already exists
                                        const existingHoliday = holidays.find(h => h.name === firstCell && h.year === currentYear);
                                        if (!existingHoliday && date.trim()) {
                                            holidays.push({
                                                name: firstCell,
                                                date: date.trim(),
                                                year: currentYear || '2025'
                                            });
                                        }
                                    }
                                }
                            }
                        });
                    }
                });
                
                // Extract summer semester information dynamically
                let summerInfo = '';
                $('div, p, .content, .main-content').each((i, elem) => {
                    const text = $(elem).text().trim();
                    if (text.includes('Summer semester') && text.length > 50 && text.length < 1000) {
                        summerInfo = text.substring(0, 500);
                    }
                });
                
                calendars.push({
                    university: 'FAST National University (NUCES)',
                    title: 'Academic Calendar',
                    url: url,
                    springSemester: springData,
                    fallSemester: fallData,
                    holidays: holidays,
                    summerSemester: summerInfo || 'Summer semester may be organized in June-July at the discretion of the campus.',
                    lastUpdated: new Date()
                });
            }
        } catch (e) {
            console.log(`   Could not fetch from ${url}: ${e.message}`);
        }
        
        if (calendars.length === 0) {
            return [{
                university: 'FAST National University (NUCES)',
                title: 'Academic Calendar',
                note: 'Calendar data will be available soon',
                url: 'https://nu.edu.pk/Student/Calender'
            }];
        }
        
        console.log(`✅ FAST: ${calendars.length} calendar entries found`);
        if (calendars[0].springSemester) {
            console.log(`   Spring Semester: ${Object.keys(calendars[0].springSemester).length} events`);
        }
        if (calendars[0].fallSemester) {
            console.log(`   Fall Semester: ${Object.keys(calendars[0].fallSemester).length} events`);
        }
        console.log(`   Holidays: ${calendars[0].holidays.length} holidays found`);
        
        return calendars;
        
    } catch (error) {
        console.error(`❌ FAST Calendar: Failed - ${error.message}`);
        return [];
    }
}

// ==================== LUMS ACADEMIC CALENDAR SCRAPER - WITH DESCRIPTION ====================
async function scrapeLUMSCalendar() {
    try {
        console.log('📅 Fetching LUMS academic calendar...');
        const calendars = [];
        
        const url = 'https://lums.edu.pk/academic-calendar';
        
        try {
            const response = await axios.get(url, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                },
                timeout: 20000,
                httpsAgent: httpsAgent
            });
            
            if (response.status === 200) {
                const $ = cheerio.load(response.data);
                
                // Find all tables with calendar data
                $('.table-responsive').each((tableIdx, table) => {
                    let semester = '';
                    const tableText = $(table).text();
                    
                    if (tableText.includes('Fall Semester')) semester = 'Fall';
                    else if (tableText.includes('Spring Semester')) semester = 'Spring';
                    else if (tableText.includes('Summer Semester')) semester = 'Summer';
                    
                    if (!semester) return;
                    
                    const events = [];
                    
                    // Parse table rows - skip header row
                    $(table).find('tbody tr').each((rowIdx, row) => {
                        const cells = $(row).find('td');
                        if (cells.length >= 3) {
                            let dateText = $(cells[0]).text().trim();
                            let typeText = $(cells[1]).text().trim();
                            let descriptionText = $(cells[2]).text().trim();
                            
                            // Clean up
                            dateText = dateText.replace(/\s+/g, ' ').trim();
                            descriptionText = descriptionText.replace(/\s+/g, ' ').trim();
                            descriptionText = descriptionText.replace(/\n/g, ' ');
                            
                            // Only add if date exists and not a header
                            if (dateText && dateText !== 'Date' && dateText.length > 5) {
                                events.push({
                                    date: dateText,
                                    type: typeText || 'Academic',
                                    description: descriptionText || ''
                                });
                            }
                        }
                    });
                    
                    if (events.length > 0) {
                        // Determine year from dates
                        let year = '2025';
                        for (const event of events) {
                            if (event.date.includes('2026')) {
                                year = '2026';
                                break;
                            }
                        }
                        
                        calendars.push({
                            university: 'LUMS',
                            title: `${semester} Semester ${year}`,
                            semester: semester,
                            events: events,
                            url: url,
                            type: 'Events',
                            lastUpdated: new Date()
                        });
                        
                        console.log(`   Found ${semester} Semester ${year}: ${events.length} events (with descriptions)`);
                    }
                });
            }
        } catch (e) {
            console.log(`   Could not fetch from ${url}: ${e.message}`);
        }
        
        // If no events found, return empty
        if (calendars.length === 0) {
            console.log('⚠️ LUMS: No calendar data found');
            return [];
        }
        
        console.log(`✅ LUMS: ${calendars.length} calendar entries found`);
        return calendars;
        
    } catch (error) {
        console.error(`❌ LUMS Calendar: Failed - ${error.message}`);
        return [];
    }
}

// ==================== IMPROVED COMSATS LAHORE PDF SCRAPER ====================
async function scrapeCOMSATSLahorePDF() {
    try {
        console.log('📅 Fetching COMSATS Lahore PDF calendar...');
        const calendars = [];
        
        const pageUrl = 'https://lahore.comsats.edu.pk/student/academic-calendar.aspx';
        
        try {
            // First, get the page to find PDF links
            const pageResponse = await axios.get(pageUrl, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000,
                httpsAgent: httpsAgent
            });
            
            const $ = cheerio.load(pageResponse.data);
            
            // Find all PDF links dynamically
            const pdfLinks = [];
            
            $('a[href$=".pdf"], a[href*=".pdf"]').each((i, elem) => {
                let linkUrl = $(elem).attr('href');
                const linkText = $(elem).text().trim();
                
                if (linkUrl && !linkUrl.startsWith('http')) {
                    linkUrl = `https://lahore.comsats.edu.pk${linkUrl}`;
                }
                
                if (linkUrl && linkUrl.endsWith('.pdf')) {
                    pdfLinks.push({
                        url: linkUrl,
                        title: linkText || linkUrl.split('/').pop(),
                        semester: detectSemester(linkText, linkUrl)
                    });
                }
            });
            
            console.log(`   Found ${pdfLinks.length} PDF links`);
            
            // Process each PDF
            for (const pdf of pdfLinks) {
                try {
                    console.log(`   Downloading: ${pdf.title}...`);
                    
                    const pdfResponse = await axios.get(pdf.url, {
                        responseType: 'arraybuffer',
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                        timeout: 30000,
                        httpsAgent: httpsAgent
                    });
                    
                    // Parse PDF content
                    const pdfData = await pdfParse(pdfResponse.data);
                    const text = pdfData.text;
                    
                    console.log(`      Extracted ${text.length} characters of text`);
                    
                    // Improved event extraction
                    const events = extractEventsImproved(text);
                    
                    calendars.push({
                        university: 'COMSATS University Islamabad, Lahore Campus',
                        title: pdf.title,
                        semester: pdf.semester,
                        events: events,
                        pdfUrl: pdf.url,
                        type: 'Extracted',
                        pageCount: pdfData.numpages,
                        lastUpdated: new Date()
                    });
                    
                    console.log(`      Extracted ${events.length} events from PDF`);
                    
                } catch (pdfError) {
                    console.log(`      Failed to parse PDF: ${pdfError.message}`);
                    calendars.push({
                        university: 'COMSATS University Islamabad, Lahore Campus',
                        title: pdf.title,
                        semester: pdf.semester,
                        pdfUrl: pdf.url,
                        type: 'PDF',
                        note: 'PDF available for download',
                        lastUpdated: new Date()
                    });
                }
            }
            
        } catch (e) {
            console.log(`   Could not fetch page: ${e.message}`);
        }
        
        if (calendars.length === 0) {
            console.log('⚠️ COMSATS Lahore: No PDF calendars found');
            return [];
        }
        
        console.log(`✅ COMSATS Lahore: Processed ${calendars.length} PDF calendars`);
        return calendars;
        
    } catch (error) {
        console.error(`❌ COMSATS Lahore PDF: Failed - ${error.message}`);
        return [];
    }
}

// Helper function to detect semester
function detectSemester(text, url) {
    const lowerText = (text + url).toLowerCase();
    
    if (lowerText.includes('spring 2026') || lowerText.includes('spring2026')) {
        return 'Spring Semester 2026';
    } else if (lowerText.includes('spring 2023') || lowerText.includes('spring2023')) {
        return 'Spring Semester 2023';
    } else if (lowerText.includes('fall 2022') || lowerText.includes('fall2022')) {
        return 'Fall Semester 2022';
    } else if (lowerText.includes('spring')) {
        return 'Spring Semester';
    } else if (lowerText.includes('fall')) {
        return 'Fall Semester';
    }
    return '';
}

// Improved event extraction function
function extractEventsImproved(text) {
    const events = [];
    const lines = text.split('\n');
    
    // Better date patterns
    const datePatterns = [
        /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
        /(\d{1,2}\/\d{1,2}\/\d{4})/,
        /(\d{4}-\d{2}-\d{2})/,
        /(February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i
    ];
    
    // Keywords that indicate event rows
    const eventKeywords = [
        'commencement', 'classes', 'examination', 'exam', 'result', 
        'break', 'holiday', 'registration', 'add/drop', 'withdrawal',
        'semester', 'orientation', 'mid term', 'final term', 'grade'
    ];
    
    let i = 0;
    while (i < lines.length) {
        let line = lines[i].trim();
        
        if (line.length > 5) {
            // Check if line contains a date
            let foundDate = null;
            let datePattern = null;
            
            for (const pattern of datePatterns) {
                const match = line.match(pattern);
                if (match) {
                    foundDate = match[0];
                    datePattern = pattern;
                    break;
                }
            }
            
            if (foundDate) {
                // Extract event text (remove date and clean)
                let eventText = line.replace(foundDate, '').trim();
                
                // Also check next line if current line is too short
                if (eventText.length < 5 && i + 1 < lines.length) {
                    let nextLine = lines[i + 1].trim();
                    if (nextLine.length > 5 && !nextLine.match(datePattern)) {
                        eventText = nextLine;
                        i++;
                    }
                }
                
                // Clean up event text
                eventText = eventText
                    .replace(/[•●○■□▪▫]/g, '')
                    .replace(/\|/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                // Remove numbering like "1.", "2.", etc.
                eventText = eventText.replace(/^\d+\.\s*/, '');
                
                if (eventText.length > 3 && eventText.length < 150) {
                    events.push({
                        event: eventText,
                        date: foundDate
                    });
                }
            }
            else {
                // Check if line contains event keywords (might be an event without date in same line)
                const lowerLine = line.toLowerCase();
                const hasKeyword = eventKeywords.some(keyword => lowerLine.includes(keyword));
                
                if (hasKeyword && line.length < 80) {
                    // Look ahead for date in next lines
                    let eventText = line;
                    let nextIndex = i + 1;
                    let foundDateInNext = null;
                    
                    while (nextIndex < lines.length && nextIndex < i + 4) {
                        const nextLine = lines[nextIndex].trim();
                        for (const pattern of datePatterns) {
                            const match = nextLine.match(pattern);
                            if (match) {
                                foundDateInNext = match[0];
                                break;
                            }
                        }
                        if (foundDateInNext) break;
                        nextIndex++;
                    }
                    
                    if (foundDateInNext) {
                        events.push({
                            event: eventText,
                            date: foundDateInNext
                        });
                        i = nextIndex;
                    }
                }
            }
        }
        i++;
    }
    
    // Remove duplicate events
    const uniqueEvents = [];
    const seenEvents = new Set();
    
    for (const event of events) {
        const eventKey = (event.event + event.date).toLowerCase().substring(0, 60);
        if (!seenEvents.has(eventKey) && event.event.length > 5) {
            seenEvents.add(eventKey);
            uniqueEvents.push(event);
        }
    }
    
    // Sort events by date if possible
    uniqueEvents.sort((a, b) => {
        const dateA = a.date.match(/\d{4}/)?.[0] || '';
        const dateB = b.date.match(/\d{4}/)?.[0] || '';
        return dateA.localeCompare(dateB);
    });
    
    return uniqueEvents.slice(0, 30);
}

// Helper function to detect semester from text
function detectSemester(text, url) {
    const lowerText = (text + url).toLowerCase();
    
    if (lowerText.includes('spring 2026') || lowerText.includes('spring2026')) {
        return 'Spring Semester 2026';
    } else if (lowerText.includes('spring 2023') || lowerText.includes('spring2023')) {
        return 'Spring Semester 2023';
    } else if (lowerText.includes('fall 2022') || lowerText.includes('fall2022')) {
        return 'Fall Semester 2022';
    } else if (lowerText.includes('spring')) {
        return 'Spring Semester';
    } else if (lowerText.includes('fall')) {
        return 'Fall Semester';
    }
    return '';
}

// Helper function to extract events from PDF text
function extractEventsFromText(text) {
    const events = [];
    const lines = text.split('\n');
    
    // Date patterns
    const datePattern = /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i;
    const dateRangePattern = /(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s*[-–]\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i;
    
    let currentEvent = null;
    
    for (let line of lines) {
        line = line.trim();
        if (line.length < 3) continue;
        
        // Check for date range
        const rangeMatch = line.match(dateRangePattern);
        if (rangeMatch) {
            if (currentEvent) {
                events.push(currentEvent);
            }
            const eventText = line.replace(rangeMatch[0], '').trim();
            if (eventText && eventText.length > 2) {
                currentEvent = {
                    event: cleanEventText(eventText),
                    date: `${rangeMatch[1]} to ${rangeMatch[2]}`
                };
            }
            continue;
        }
        
        // Check for single date
        const dateMatch = line.match(datePattern);
        if (dateMatch) {
            if (currentEvent) {
                events.push(currentEvent);
            }
            const date = dateMatch[0];
            let eventText = line.replace(date, '').trim();
            eventText = cleanEventText(eventText);
            
            if (eventText && eventText.length > 2) {
                currentEvent = { event: eventText, date: date };
            }
            continue;
        }
        
        // Append to current event
        if (currentEvent && line.length > 5 && !line.match(/^\d+$/)) {
            currentEvent.event += ' ' + cleanEventText(line);
        }
    }
    
    // Add last event
    if (currentEvent && currentEvent.event && currentEvent.event.length > 3) {
        events.push(currentEvent);
    }
    
    // Clean and deduplicate events
    const uniqueEvents = [];
    const seen = new Set();
    
    for (const event of events) {
        if (event.event && event.event.length > 5 && event.event.length < 150) {
            const key = event.event.toLowerCase().substring(0, 50);
            if (!seen.has(key)) {
                seen.add(key);
                // Clean up the event name
                event.event = event.event.replace(/\s+/g, ' ').trim();
                event.event = event.event.substring(0, 100);
                uniqueEvents.push(event);
            }
        }
    }
    
    return uniqueEvents.slice(0, 30); // Limit to 30 events
}

function cleanEventText(text) {
    return text
        .replace(/[•●○■□▪▫]/g, '')
        .replace(/[*]{2,}/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// UCP Academic Calendar
// ==================== UCP CALENDAR SCRAPER - FULLY DYNAMIC ====================
async function scrapeUCPCalendar() {
    try {
        console.log('📅 Fetching UCP academic calendar...');
        const calendars = [];
        
        const url = 'https://ucp.edu.pk/academic-calendar/';
        
        try {
            const response = await axios.get(url, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000,
                httpsAgent: httpsAgent
            });
            
            if (response.status === 200) {
                const $ = cheerio.load(response.data);
                
                // Find all tables and process them
                let currentSemester = '';
                
                $('table').each((tableIdx, table) => {
                    const events = [];
                    
                    // Look at previous elements to find semester heading
                    let prevElement = $(table).prev();
                    let semesterFound = false;
                    let depth = 0;
                    
                    while (prevElement.length && depth < 15) {
                        const prevText = prevElement.text().trim();
                        
                        if (prevText.includes('Spring 2026')) {
                            currentSemester = 'Spring Semester 2026';
                            semesterFound = true;
                            break;
                        } else if (prevText.includes('Summer 2026')) {
                            currentSemester = 'Summer Semester 2026';
                            semesterFound = true;
                            break;
                        } else if (prevText.includes('Fall 2025')) {
                            currentSemester = 'Fall Semester 2025';
                            semesterFound = true;
                            break;
                        } else if (prevText.includes('Holiday') || prevText.includes('Eid') || prevText.includes('Convocation')) {
                            currentSemester = 'Public Holidays';
                            semesterFound = true;
                            break;
                        }
                        
                        prevElement = prevElement.prev();
                        depth++;
                    }
                    
                    // If no semester found from headings, check table content
                    if (!semesterFound) {
                        const tableText = $(table).text();
                        if (tableText.includes('February') || tableText.includes('March') || tableText.includes('April')) {
                            currentSemester = 'Spring Semester 2026';
                        } else if (tableText.includes('July') || tableText.includes('August')) {
                            currentSemester = 'Summer Semester 2026';
                        } else if (tableText.includes('September') || tableText.includes('October') || tableText.includes('November')) {
                            currentSemester = 'Fall Semester 2025';
                        } else if (tableText.includes('Eid') || tableText.includes('Holiday') || tableText.includes('Convocation')) {
                            currentSemester = 'Public Holidays';
                        }
                    }
                    
                    // Parse table rows
                    const rows = $(table).find('tr');
                    let headers = [];
                    let isFirstRow = true;
                    
                    rows.each((rowIdx, row) => {
                        const cells = $(row).find('td, th');
                        const cellTexts = [];
                        
                        cells.each((cellIdx, cell) => {
                            cellTexts.push($(cell).text().trim());
                        });
                        
                        // Detect header row
                        if (isFirstRow && (cellTexts[0] === 'No.' || cellTexts[0] === 'Activity' || cellTexts[0] === 'Event')) {
                            headers = cellTexts;
                            isFirstRow = false;
                            return;
                        }
                        isFirstRow = false;
                        
                        // Skip empty rows
                        if (cellTexts.length < 2) return;
                        
                        let eventName = '';
                        let eventDate = '';
                        let eventWeek = '';
                        
                        // Determine which columns contain event and date based on headers
                        if (headers.includes('Activity') && headers.includes('Date')) {
                            const activityIndex = headers.indexOf('Activity');
                            const dateIndex = headers.indexOf('Date');
                            if (activityIndex !== -1 && dateIndex !== -1) {
                                eventName = cellTexts[activityIndex] || '';
                                eventDate = cellTexts[dateIndex] || '';
                                if (headers.includes('Semester Week')) {
                                    const weekIndex = headers.indexOf('Semester Week');
                                    eventWeek = cellTexts[weekIndex] || '';
                                }
                            }
                        } else if (headers.includes('No.') && headers.includes('Details') && headers.includes('Date')) {
                            const detailsIndex = headers.indexOf('Details');
                            const dateIndex = headers.indexOf('Date');
                            if (detailsIndex !== -1 && dateIndex !== -1) {
                                eventName = cellTexts[detailsIndex] || '';
                                eventDate = cellTexts[dateIndex] || '';
                            }
                        } else {
                            // Auto-detect based on content
                            for (let i = 0; i < cellTexts.length; i++) {
                                const text = cellTexts[i];
                                if (text && (text.match(/\d{1,2}\s+[A-Za-z]+\s+\d{4}/) || text.match(/[A-Za-z]+\s+\d{1,2},\s+\d{4}/))) {
                                    eventDate = text;
                                } else if (text && text.length > 2 && text !== 'Date' && text !== 'Details' && text !== 'Activity') {
                                    eventName = text;
                                }
                            }
                        }
                        
                        // Clean up event name (remove numbering)
                        if (eventName) {
                            eventName = eventName.replace(/^\d+\.\s*/, '');
                            eventName = eventName.replace(/[•●○■□▪▫]/g, '').trim();
                            eventName = eventName.replace(/[*]{2,}/g, '').trim();
                            
                            // Skip header-like text
                            if (eventName && eventDate && 
                                eventName !== 'Details' && eventName !== 'Date' && 
                                eventName !== 'Activity' && eventName !== 'Semester Week' &&
                                !eventName.match(/No\./i) && eventName.length > 2 && eventDate.length > 2) {
                                
                                events.push({ 
                                    event: eventName, 
                                    date: eventDate,
                                    week: eventWeek
                                });
                            }
                        }
                    });
                    
                    // Add to calendars if we have events and a valid semester
                    if (events.length > 0 && currentSemester) {
                        // Check if this semester already exists to avoid duplicates
                        const existingIndex = calendars.findIndex(c => c.title === currentSemester);
                        if (existingIndex === -1) {
                            calendars.push({
                                university: 'University of Central Punjab (UCP)',
                                title: currentSemester,
                                events: events,
                                url: url,
                                type: 'HTML'
                            });
                        } else {
                            // Merge events if semester already exists
                            calendars[existingIndex].events.push(...events);
                        }
                    }
                });
                
                // Remove duplicate events within each calendar
                calendars.forEach(calendar => {
                    if (calendar.events) {
                        const uniqueEvents = [];
                        const seen = new Set();
                        for (const event of calendar.events) {
                            const key = event.event.toLowerCase();
                            if (!seen.has(key)) {
                                seen.add(key);
                                uniqueEvents.push(event);
                            }
                        }
                        calendar.events = uniqueEvents;
                    }
                });
                
                // Extract PDF links
                $('a[href$=".pdf"]').each((i, elem) => {
                    const linkText = $(elem).text().trim();
                    const linkUrl = $(elem).attr('href');
                    if (linkText && (linkText.toLowerCase().includes('calendar') || linkText.toLowerCase().includes('admission'))) {
                        calendars.push({
                            university: 'University of Central Punjab (UCP)',
                            title: linkText || 'Academic Calendar PDF',
                            url: linkUrl.startsWith('http') ? linkUrl : `https://ucp.edu.pk${linkUrl}`,
                            type: 'PDF'
                        });
                    }
                });
            }
        } catch (e) {
            console.log(`   Could not fetch from ${url}: ${e.message}`);
        }
        
        if (calendars.length === 0) {
            console.log('⚠️ UCP: No calendar data found');
            return [{
                university: 'University of Central Punjab (UCP)',
                title: 'Academic Calendar',
                note: 'Please check university website for current academic calendar',
                url: 'https://ucp.edu.pk/academic-calendar/'
            }];
        }
        
        console.log(`✅ UCP: ${calendars.length} calendar items found`);
        calendars.forEach(cal => {
            if (cal.events) {
                console.log(`   ${cal.title}: ${cal.events.length} events`);
            } else if (cal.type === 'PDF') {
                console.log(`   PDF: ${cal.title}`);
            }
        });
        
        return calendars;
        
    } catch (error) {
        console.error(`❌ UCP Calendar: Failed - ${error.message}`);
        return [{
            university: 'University of Central Punjab (UCP)',
            title: 'Academic Calendar',
            note: 'Contact university for calendar information',
            url: 'https://ucp.edu.pk'
        }];
    }
}

/// GIKI Academic Calendar - Pure PDF Scraper (No Hardcoded Data)
async function scrapeGIKICalendar() {
    try {
        console.log('📅 Fetching GIKI academic calendar...');
        const calendars = [];
        
        const url = 'https://giki.edu.pk/academics/academic-calendar/';
        
        try {
            const response = await axios.get(url, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000,
                httpsAgent: httpsAgent
            });
            
            if (response.status === 200) {
                const $ = cheerio.load(response.data);
                
                // Find the PDF link for Academic Calendar
                let pdfUrl = null;
                $('a[href$=".pdf"]').each((i, link) => {
                    const href = $(link).attr('href');
                    const linkText = $(link).text().trim();
                    
                    // Look for Academic Calendar PDF
                    if (linkText.includes('Academic Calendar') || 
                        (href && href.includes('Academic-Calendar'))) {
                        pdfUrl = href.startsWith('http') ? href : `https://giki.edu.pk${href}`;
                        console.log(`   Found PDF: ${linkText} -> ${pdfUrl}`);
                    }
                });
                
                // If PDF found, download and parse it
                if (pdfUrl) {
                    try {
                        console.log(`   Downloading PDF: ${pdfUrl}`);
                        const pdfResponse = await axios.get(pdfUrl, {
                            responseType: 'arraybuffer',
                            headers: { 'User-Agent': 'Mozilla/5.0' },
                            timeout: 30000,
                            httpsAgent: httpsAgent
                        });
                        
                        // Parse PDF content
                        const pdfData = await pdfParse(pdfResponse.data);
                        const text = pdfData.text;
                        
                        console.log(`   Extracted ${text.length} characters from PDF`);
                        
                        // Extract calendar data from PDF text
                        const calendarData = extractGIKICalendarFromPDF(text);
                        
                        calendars.push({
                            university: 'Ghulam Ishaq Khan Institute (GIKI)',
                            title: 'Academic Calendar 2025-2026',
                            url: url,
                            pdfUrl: pdfUrl,
                            data: calendarData,
                            type: 'PDF',
                            pageCount: pdfData.numpages,
                            lastUpdated: new Date()
                        });
                        
                        console.log(`   ✅ Fall 2025: ${calendarData.fall2025.length} events`);
                        console.log(`   ✅ Spring 2026: ${calendarData.spring2026.length} events`);
                        console.log(`   ✅ Summer 2026: ${calendarData.summer2026.length} events`);
                        console.log(`   ✅ Fall 2026: ${calendarData.fall2026.length} events`);
                        
                    } catch (pdfError) {
                        console.log(`   Failed to parse PDF: ${pdfError.message}`);
                        calendars.push({
                            university: 'Ghulam Ishaq Khan Institute (GIKI)',
                            title: 'Academic Calendar 2025-2026',
                            url: url,
                            pdfUrl: pdfUrl,
                            type: 'PDF',
                            note: 'PDF available for download - parsing failed',
                            lastUpdated: new Date()
                        });
                    }
                } else {
                    console.log('   No PDF calendar found on page');
                    calendars.push({
                        university: 'Ghulam Ishaq Khan Institute (GIKI)',
                        title: 'Academic Calendar',
                        url: url,
                        type: 'Link',
                        note: 'Calendar PDF not found on page',
                        lastUpdated: new Date()
                    });
                }
            }
        } catch (e) {
            console.log(`   Could not fetch from ${url}: ${e.message}`);
        }
        
        if (calendars.length === 0) {
            return [{
                university: 'Ghulam Ishaq Khan Institute (GIKI)',
                title: 'Academic Calendar',
                note: 'Unable to fetch calendar data',
                url: 'https://giki.edu.pk/academics/academic-calendar/'
            }];
        }
        
        console.log(`✅ GIKI: ${calendars.length} calendar entries found`);
        return calendars;
        
    } catch (error) {
        console.error(`❌ GIKI Calendar: Failed - ${error.message}`);
        return [{
            university: 'Ghulam Ishaq Khan Institute (GIKI)',
            title: 'Academic Calendar',
            note: 'Error fetching calendar',
            url: 'https://giki.edu.pk'
        }];
    }
}


// ==================== MAIN CALENDAR SCRAPER FUNCTION ====================
async function scrapeAllCalendars() {
    console.log('\n' + '='.repeat(70));
    console.log('📅 ACADEMIC CALENDAR SCRAPER');
    console.log('='.repeat(70) + '\n');
    
    const allResults = {
        fetched: new Date().toISOString(),
        universities: {}
    };
    
    // Scrape FAST
    allResults.universities.FAST = await scrapeFASTCalendar();
    
    // Scrape LUMS
    allResults.universities.LUMS = await scrapeLUMSCalendar();
    
    // Scrape COMSATS Lahore PDF (NEW)
    allResults.universities.COMSATSLahore = await scrapeCOMSATSLahorePDF();
    
    // Scrape UCP
    allResults.universities.UCP = await scrapeUCPCalendar();
    
    // Scrape GIKI
    allResults.universities.GIKI = await scrapeGIKICalendar();
    
    console.log('\n' + '='.repeat(70));
    console.log('📅 CALENDAR SCRAPING COMPLETED');
    console.log('='.repeat(70) + '\n');
    
    return allResults;
}
module.exports = { 
    scrapeAllCalendars,
    scrapeFASTCalendar,
    scrapeLUMSCalendar,
    scrapeCOMSATSLahorePDF,
    scrapeUCPCalendar,
    scrapeGIKICalendar
};