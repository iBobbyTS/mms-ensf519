import unittest
from time import sleep, time_ns
from selenium import webdriver
from selenium.webdriver.common.by import By

BASE_URL = "http://localhost:8787"
DELAY = 3


class MMSBrowserTests(unittest.TestCase):
    def setUp(self):
        self.driver = webdriver.Chrome()
        self.addCleanup(self.driver.quit)
        self.driver.maximize_window()
        self.driver.implicitly_wait(10)
        self.driver.get(BASE_URL)
        self.driver.add_cookie({"name": "PARAGLIDE_LOCALE", "value": "en", "path": "/"})

    def tearDown(self):
        sleep(DELAY)

    def open_page(self, path):
        self.driver.get(BASE_URL + path)
        self.driver.find_element(By.CSS_SELECTOR, 'main[data-browser-ready="true"]')
        sleep(DELAY)

    def test_home(self):
        self.open_page("/")
        self.assertEqual(self.driver.current_url, BASE_URL + "/home")
        link = self.driver.find_element(By.CSS_SELECTOR, 'a[href="/members"]')
        self.assertTrue(link.is_displayed())

    def test_member_profile(self):
        self.open_page("/members")
        title = self.driver.find_element(By.CSS_SELECTOR, "main h1")
        self.assertEqual(title.text, "Member Directory")

        self.driver.find_element(By.CSS_SELECTOR, 'a[href="/members/SCSC0001"]').click()
        sleep(DELAY)
        self.assertEqual(self.driver.current_url, BASE_URL + "/members/SCSC0001")
        self.driver.find_element(By.CSS_SELECTOR, 'a[href="/members/SCSC0001/edit"]').click()
        sleep(DELAY)
        self.assertEqual(self.driver.current_url, BASE_URL + "/members/SCSC0001/edit")
        field = self.driver.find_element(By.CSS_SELECTOR, 'form input:not([type="hidden"])')
        self.assertTrue(field.is_displayed())

    def test_member_search(self):
        self.open_page("/members")
        members = self.driver.find_elements(By.CSS_SELECTOR, 'tbody a[href^="/members/"]')
        self.assertGreater(len(members), 1)
        search = self.driver.find_element(By.CSS_SELECTOR, 'input[aria-label="Search member ID, name, or pinyin"]')
        search.send_keys("SCSC0001")
        sleep(DELAY)
        results = self.driver.find_elements(By.CSS_SELECTOR, 'tbody a[href^="/members/"]')
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].get_attribute("href"), BASE_URL + "/members/SCSC0001")

    def test_invalid_card_download(self):
        self.open_page("/members/card-download")
        self.driver.find_element(By.CSS_SELECTOR, "form input").send_keys("invalid-number")
        sleep(DELAY)
        self.driver.find_element(By.CSS_SELECTOR, 'form button[type="submit"]').click()
        error = self.driver.find_element(By.CSS_SELECTOR, '[role="alert"]')
        self.assertEqual(error.text, "Enter valid member numbers or ranges.")

    def test_interest_group(self):
        self.open_page("/interest-group/manage")
        name = "Test Group " + str(time_ns())

        # Create a group with a unique name.
        self.driver.find_element(By.CSS_SELECTOR, ".page-header button").click()
        self.driver.find_element(By.NAME, "interestGroupName").send_keys(name)
        sleep(DELAY)
        self.driver.find_element(By.CSS_SELECTOR, 'dialog[open] button[type="submit"]').click()
        row = self.driver.find_element(By.XPATH, f"//tr[contains(., '{name}')]")
        group_id = row.get_attribute("data-interest-group-id")
        row_selector = f'tr[data-interest-group-id="{group_id}"]'

        try:
            # Rename it and reload the page to check it was saved.
            self.open_page("/interest-group/manage")
            self.driver.find_element(By.CSS_SELECTOR, row_selector + ' button[type="button"]').click()
            field = self.driver.find_element(By.NAME, "interestGroupName")
            field.clear()
            field.send_keys(name + " renamed")
            sleep(DELAY)
            self.driver.find_element(By.CSS_SELECTOR, 'form[action$="/rename"] button[type="submit"]').click()
            sleep(DELAY)
            self.open_page("/interest-group/manage")
            row = self.driver.find_element(By.CSS_SELECTOR, row_selector)
            self.assertIn(name + " renamed", row.text)
        finally:
            # Delete our group even if the rename assertion fails.
            self.open_page("/interest-group/manage")
            self.driver.find_element(By.CSS_SELECTOR, row_selector + ' button[type="submit"]').click()
            sleep(DELAY)
            self.driver.switch_to.alert.accept()
            sleep(DELAY)
            self.assertEqual(self.driver.current_url, BASE_URL + "/interest-group/manage")
            self.driver.find_element(By.CSS_SELECTOR, 'main[data-browser-ready="true"]')
            self.assertEqual(self.driver.find_elements(By.CSS_SELECTOR, row_selector), [])


if __name__ == "__main__":
    unittest.main(verbosity=2, failfast=True)
