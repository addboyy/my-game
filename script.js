document.documentElement.classList.add("js-enabled");

const dateElement = document.querySelector("#today-date");

if (dateElement) {
	const today = new Date();
	const dateParts = [today.getFullYear(), today.getMonth() + 1, today.getDate()];
	const isoDate = dateParts
		.map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0"))
		.join("-");

	dateElement.dateTime = isoDate;
	dateElement.textContent = new Intl.DateTimeFormat("ko-KR", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(today);
}